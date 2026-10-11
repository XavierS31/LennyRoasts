import * as THREE from "three";
import { stoneUVs } from "./exteriorMaterials";

type Point = [number, number];

// Ground-space relationships inferred from the five photos, not a surveyed map.
// The near corner has lawn islands, a broad forecourt and a curbside sidewalk.
export const entryWalk: Point[] = [
  [-43, 21.6], [-38, 23], [-31.5, 23], [-31.5, 15.05], [-25.2, 15.05],
  [-25.2, 21.2], [12, 21.2], [12, 25.4], [-22, 25.4], [-23, 34],
  [-29, 42], [-31, 46.4], [-37, 46.4], [-32, 35], [-34, 30], [-43, 30],
];
const pondEdge: Point[] = [
  [-72, 86], [-57, 78], [-36, 73], [-12, 69], [14, 70], [37, 73],
  [65, 71], [83, 82], [83, 109], [-72, 109],
];

function shapeFrom(points: Point[]) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath(); return shape;
}

function surfaceMap(base: [number, number, number], variation: number, kind: "grass" | "asphalt" | "concrete" | "mulch" | "water") {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const data = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const value = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 101 / 100;
      const mottling = Math.sin(x / 31) * Math.cos(y / 47) * variation * (kind === "grass" ? .08 : .18);
      const delta = (value - .5) * variation + mottling;
      const i = (y * 512 + x) * 4;
      for (let c = 0; c < 3; c++) data.data[i + c] = base[c] + delta;
      data.data[i + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  if (kind === "grass") {
    for (let i = 0; i < 65; i++) {
      ctx.fillStyle = i % 4 ? "rgba(40,77,32,.09)" : "rgba(157,133,65,.17)";
      ctx.beginPath(); ctx.ellipse(i * 137 % 512, i * 79 % 512, 15 + i % 33, 9 + i % 23, i, 0, Math.PI * 2); ctx.fill();
    }
    // Fine blades plus larger mixed green/ochre patches, rather than flat green.
    for (let i = 0; i < 12000; i++) {
      ctx.strokeStyle = i % 3 ? "rgba(139,151,75,.30)" : "rgba(35,65,30,.28)";
      const x = i * 137 % 512, y = i * 79 % 512;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (i % 3) - 1, y - 2 - i % 4); ctx.stroke();
    }
  }
  if (kind === "asphalt") {
    // Aggregate, faded repairs and hairline cracks repeat at a physical scale.
    ctx.strokeStyle = "rgba(20,23,22,.3)"; ctx.lineWidth = .7;
    for (let i = 0; i < 9; i++) {
      const x = i * 67 % 512, y = i * 91 % 512;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y + 22); ctx.lineTo(x + 3, y + 34); ctx.lineTo(x + 18, y + 51); ctx.stroke();
    }
    ctx.fillStyle = "rgba(26,29,27,.12)"; ctx.fillRect(190, 95, 85, 130);
  }
  if (kind === "concrete") {
    ctx.strokeStyle = "rgba(97,91,79,.25)"; ctx.lineWidth = 1.2;
    ctx.strokeRect(.6, .6, 511, 511);
    ctx.strokeStyle = "rgba(125,115,98,.10)";
    ctx.beginPath(); ctx.moveTo(194, 40); ctx.lineTo(219, 63); ctx.lineTo(218, 87); ctx.stroke();
  }
  if (kind === "water") {
    ctx.strokeStyle = "rgba(217,231,218,.18)"; ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 13) {
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8) ctx.lineTo(x, y + Math.sin(x / 19 + y) * 2);
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  return map;
}

export function addCampusSite(scene: THREE.Scene) {
  const grass = new THREE.MeshStandardMaterial({ color: 0xffffff, map: surfaceMap([86,111,52], 32, "grass"), roughness: .98 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0xffffff, map: surfaceMap([57,60,60], 28, "asphalt"), roughness: .93 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xffffff, map: surfaceMap([188,185,169], 18, "concrete"), roughness: .9 });
  const mulch = new THREE.MeshStandardMaterial({ color: 0xffffff, map: surfaceMap([79,58,40], 30, "mulch"), roughness: 1 });
  const curb = new THREE.MeshStandardMaterial({ color: 0xbab9a9, roughness: .92 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xdadbd1, roughness: .9 });
  const paleMetal = new THREE.MeshStandardMaterial({ color: 0xcbcec5, roughness: .48, metalness: .3 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x6e6750, roughness: .96 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .98 });
  const darkLeaf = new THREE.MeshStandardMaterial({ color: 0x315331, roughness: .98 });

  const addSurface = (shape: THREE.Shape, y: number, material: THREE.Material, tile: number, name: string, depth = 0) => {
    const geometry = depth ? new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:false, curveSegments:64}) : new THREE.ShapeGeometry(shape,64);
    geometry.rotateX(-Math.PI / 2); stoneUVs(geometry, tile);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.y = y;
    mesh.name = name; mesh.receiveShadow = true; scene.add(mesh); return mesh;
  };
  const solid = (size: [number,number,number], at: [number,number,number], material: THREE.Material, name = "") => {
    const mesh = new THREE.Mesh(stoneUVs(new THREE.BoxGeometry(...size), 3.8), material);
    mesh.position.set(...at); mesh.name = name;
    mesh.receiveShadow = mesh.castShadow = true; scene.add(mesh); return mesh;
  };
  const ground = shapeFrom([[-137,-77],[94,-77],[94,111],[-137,111]]);
  const hole = new THREE.Path(); pondEdge.forEach(([x,z],i) => i ? hole.lineTo(x,-z) : hole.moveTo(x,-z)); hole.closePath(); ground.holes.push(hole);
  addSurface(ground, -.04, grass, 8, "Textured campus lawn");
  const water = new THREE.MeshPhysicalMaterial({color:0x6e8a83, map:surfaceMap([139,164,153],12,"water"), metalness:.28, roughness:.23, clearcoat:1});
  addSurface(shapeFrom(pondEdge), -.22, water, 12, "Pond beyond the road and lawn");
  // A single road surface rounds the corner instead of overlapping two black boxes.
  const road = new THREE.Shape(); road.moveTo(-76,77); road.lineTo(-60,77); road.lineTo(-60,-38);
  road.absarc(-49,-38,11,Math.PI,Math.PI*1.5,false); road.lineTo(94,-49); road.lineTo(94,-65); road.lineTo(-49,-65);
  road.absarc(-49,-38,27,Math.PI*1.5,Math.PI,true); road.closePath();
  addSurface(road, -.015, asphalt, 7, "Curved campus road");
  // Curbside sidewalk is continuous around the corner. The entrance walk joins it.
  const sidewalk = new THREE.Shape(); sidewalk.moveTo(-59.7,77); sidewalk.lineTo(-56.5,77); sidewalk.lineTo(-56.5,-38);
  sidewalk.absarc(-49,-38,7.5,Math.PI,Math.PI*1.5,false); sidewalk.lineTo(94,-45.5); sidewalk.lineTo(94,-48.7); sidewalk.lineTo(-49,-48.7);
  sidewalk.absarc(-49,-38,10.7,Math.PI*1.5,Math.PI,true); sidewalk.closePath();
  addSurface(sidewalk, .02, concrete, 3.8, "Continuous curbside sidewalk", .12);
  addSurface(shapeFrom(entryWalk), .03, concrete, 3.8, "Engineering II entrance forecourt", .12);
  addSurface(shapeFrom([[12,21.2],[59,21.2],[59,25.4],[12,25.4]]), .03, concrete, 3.8, "Front facade pedestrian walk", .12);
  addSurface(shapeFrom([[-56.5,-37],[-49.18,-37],[-49.18,-33],[-56.5,-33]]), .03, concrete, 3.8, "Left wing entrance spur", .12);
  // Across the road: sidewalk, lawn, then Health Sciences, as in photo 1.
  const oppositeWalk = new THREE.Shape(); oppositeWalk.moveTo(-80,77); oppositeWalk.lineTo(-76.3,77); oppositeWalk.lineTo(-76.3,-38);
  oppositeWalk.absarc(-49,-38,27.3,Math.PI,Math.PI*1.5,false); oppositeWalk.lineTo(94,-65.3); oppositeWalk.lineTo(94,-69); oppositeWalk.lineTo(-49,-69);
  oppositeWalk.absarc(-49,-38,31,Math.PI*1.5,Math.PI,true); oppositeWalk.closePath();
  addSurface(oppositeWalk, .02, concrete, 3.8, "Health Sciences curbside sidewalk", .12);
  addSurface(shapeFrom([[-96,-29],[-76.3,-29],[-76.3,-13],[-96,-13]]), .025, concrete, 3.8, "Health Sciences service drive", .1);
  addSurface(shapeFrom([[-122,8.8],[-93,8.8],[-93,11.8],[-122,11.8]]), .025, concrete, 3.8, "Palm arcade pedestrian walk", .12);
  addSurface(shapeFrom([[-95,10],[-92,10],[-78,24],[-78,28],[-81,28]]), .03, concrete, 3.8, "Health Sciences corner approach", .12);
  for (const [from, to] of [[-77,-29],[-13,38]]) solid([.22,.18,to-from],[-76.18,.065,(from+to)/2],curb,"Opposite roadside curb");
  // Thin curb and painted edge follow the same bend as the road and sidewalk.
  const curvedStrip = (inner: number, outer: number, material: THREE.Material, y: number, name: string, depth=0) => {
    const shape = new THREE.Shape(); shape.moveTo(-49-inner,-38);
    shape.absarc(-49,-38,inner,Math.PI,Math.PI*1.5,false); shape.lineTo(-49,-38-outer);
    shape.absarc(-49,-38,outer,Math.PI*1.5,Math.PI,true); shape.closePath();
    addSurface(shape,y,material,3.8,name,depth);
  };
  solid([.22,.18,115],[-59.9,.065,-19.5],curb,"Straight Engineering curb");
  solid([143,.18,.22],[22.5,.065,48.9],curb,"Front Engineering curb");
  curvedStrip(10.8,11,curb,.065,"Rounded inner curb",.12);
  solid([143,.18,.22],[22.5,.065,65.18],curb,"Front opposite curb");
  curvedStrip(27.08,27.28,curb,.065,"Rounded outer curb",.12);
  solid([139,.016,.12],[24.5,.015,49.75],paint,"Faded road edge line");
  const yellowPaint = new THREE.MeshStandardMaterial({color:0xd9b64e,roughness:.98});
  for (const x of [-68.2,-67.8]) {
    solid([.13,.018,99],[x,.02,-27.5],yellowPaint,"Double yellow center line");
    solid([.13,.018,7],[x,.02,34.5],yellowPaint,"Center line beyond crossing");
  }
  for (const radius of [18.8,19.2]) {
    curvedStrip(radius-.065,radius+.065,yellowPaint,.023,"Curved double yellow line");
    solid([143,.018,.13],[22.5,.023,38+radius],yellowPaint,"Front double yellow line");
  }
  for (let x=-74.5; x<-60; x+=2.65) solid([1.15,.022,2.8],[x,.026,26.5],paint,"Pedestrian crossing stripe");
  solid([15.2,.018,.28],[-68,.026,23.8],paint,"Crossing stop line");
  for (const z of [-18, 13, 35]) {
    solid([.6,.022,1.15],[-75.85,.03,z],new THREE.MeshStandardMaterial({color:0x343a38,roughness:.95}),"Health Sciences gutter drain");
    for (let i=0;i<7;i++) solid([.55,.025,.055],[-75.85,.046,z-.48+i*.16],paleMetal,"Drain grate bar");
  }
  // Pavement seams and utility covers remain visible from the street camera.
  for (let z=-73; z<38; z+=3.8) solid([3.6,.012,.025],[-78.15,.147,z],curb,"Sidewalk expansion joint");
  for (const z of [-26,-16]) {
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.028,24),paleMetal);
    cover.position.set(-83,.151,z); cover.receiveShadow=true; scene.add(cover);
  }
  for (const z of [-27.5,-14.5]) solid([8,.018,.12],[-86,.145,z],yellowPaint,"Service drive safety marking");
  for (const x of [-9,35]) {
    solid([1.1,.018,.45],[x,.03,48.85],new THREE.MeshStandardMaterial({color:0x343a38,roughness:.9}),"Curb drain");
    for (let i=0;i<6;i++) solid([.065,.018,.44],[x-.4+i*.16,.046,48.85],paleMetal);
  }

  // Low plant beds border glazing but leave the recessed entrance and paths open.
  addSurface(shapeFrom([[-55,-49],[-49.4,-49],[-49.4,-37],[-55,-37]]),.005,mulch,3,"Left end planting bed");
  addSurface(shapeFrom([[-55,-33],[-49.4,-33],[-49.4,16],[-54,16]]),.005,mulch,3,"Long left wing planting bed");
  addSurface(shapeFrom([[-52,18],[-45,18],[-42.5,23],[-44,29],[-52,29],[-55,24]]),.005,mulch,3,"Tower-side planted island");
  addSurface(shapeFrom([[-22,19.95],[10,19.95],[10,21],[-22,21]]),.005,mulch,3,"Front window planting border");
  addSurface(shapeFrom([[13,25.6],[35,25.6],[35,29],[13,29]]),.005,mulch,3,"East facade planting border");
  const trees: Array<[number,number,number]> = [
    [-52,-27,7.5],[-52,-11,8],[-52,6,7.5],[-48,23,8],[-18,20.7,5.7],[-5,20.7,5.5],
    [7,20.7,5.7],[20,27,6.2],[32,27,6.5],[60,8,7.5],[56,-36,8],
    [-86,27,8.5],[-88,-39,8],[-123,21,7],
  ];
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.21,1,7),bark,trees.length*3);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),leaf,trees.length*18);
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  trees.forEach(([x,z,h],index)=>{
    for(let branch=0;branch<3;branch++) {
      const a=branch*Math.PI*2/3, direction=new THREE.Vector3(Math.sin(a)*.2,1,Math.cos(a)*.2).normalize();
      quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
      matrix.compose(new THREE.Vector3(x+Math.sin(a)*.25,h*.31,z+Math.cos(a)*.25),quaternion,new THREE.Vector3(1,h*.65,1));
      trunks.setMatrixAt(index*3+branch,matrix);
    }
    for(let cluster=0;cluster<18;cluster++) {
      const a=cluster*2.39996, radius=cluster < 5 ? 1 : 2.2;
      matrix.compose(new THREE.Vector3(x+Math.sin(a)*radius,h*.75+(cluster%3)*.45,z+Math.cos(a)*radius*.85),new THREE.Quaternion(),new THREE.Vector3(1.65,1.3,1.55));
      crowns.setMatrixAt(index*18+cluster,matrix);
      crowns.setColorAt(index*18+cluster,new THREE.Color(cluster%2?0x46623b:0x355532));
    }
  });
  trunks.castShadow = crowns.castShadow = true; trunks.receiveShadow = crowns.receiveShadow = true;
  trunks.name="Multi-stem campus trees"; crowns.name="Broad layered tree canopies"; scene.add(trunks,crowns);
  // Sparse three-dimensional blades over the reference lawn, with gaps around
  // the pavement. One draw call, deterministic positions, no animated grass.
  const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(.018,.18,3),darkLeaf,3600);
  let bladeCount=0;
  for(let i=0;i<3600;i++) {
    const x=-126+(((i*73856093)>>>0)%10007)/10007*44, z=14+(((i*19349663)>>>0)%10009)/10009*29;
    if(x>-94 && z<30 && z<10+(x+95)*1.3) continue;
    matrix.compose(new THREE.Vector3(x,.045,z),new THREE.Quaternion(),new THREE.Vector3(1,.7+(i%5)*.16,1));
    blades.setMatrixAt(bladeCount,matrix); blades.setColorAt(bladeCount,new THREE.Color(i%4?0x668149:0x918447)); bladeCount++;
  }
  blades.count=bladeCount; blades.receiveShadow=true; blades.name="Health Sciences lawn blades"; scene.add(blades);
  const shrubPositions: Point[] = [];
  for(let z=-46;z<15;z+=2.2) if (z < -38 || z > -32) shrubPositions.push([-50.8,z]);
  for(let x=-21;x<10;x+=2.2) shrubPositions.push([x,20.7]);
  for(let x=15;x<34;x+=2.2) shrubPositions.push([x,27.7]);
  for(let i=0;i<12;i++) shrubPositions.push([-50+(i%4)*1.7,21+Math.floor(i/4)*2]);
  const shrubs=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),darkLeaf,shrubPositions.length);
  shrubPositions.forEach(([x,z],i)=>{
    matrix.compose(new THREE.Vector3(x,.75,z),new THREE.Quaternion(),new THREE.Vector3(1.3,.8,1.05)); shrubs.setMatrixAt(i,matrix);
  }); shrubs.castShadow=shrubs.receiveShadow=true; shrubs.name="Low hedges and rounded shrubs"; scene.add(shrubs);
  // Disc-topped light poles and concrete bases match the courtyard references.
  for(const [x,z] of [[-51,32],[-38,39],[-19,39],[5,39],[31,41],[55,39]] as Point[]) {
    solid([.46,.55,.46],[x,.28,z],curb,"Light pole concrete base");
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.085,5.6,10),paleMetal); pole.position.set(x,3.25,z); pole.castShadow=true; scene.add(pole);
    const lamp=new THREE.Mesh(new THREE.ConeGeometry(.42,.16,20),paleMetal); lamp.position.set(x,6.1,z); scene.add(lamp);
    const diffuser=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.12,16),new THREE.MeshStandardMaterial({color:0xe0e3d4,roughness:.5})); diffuser.position.set(x,5.98,z); scene.add(diffuser);
  }
}
