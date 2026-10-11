import * as THREE from "three";
import { framedWindow, stoneUVs, type ExteriorMaterials } from "./exteriorMaterials";
import { brickMap } from "./healthSciencesGeometry";
import type { addCampusSite } from "./campusSite";

/** Photo-inferred backdrop: front elevation faces south, down the existing lane. */
export const streetEndLayout = { center: [-68, -113] as const, width: 104, depth: 22, height: 20.4, junctionZ: -86 };

export function addStreetEnd(scene: THREE.Scene, facade: ExteriorMaterials, site: ReturnType<typeof addCampusSite>) {
  const building = new THREE.Group(); building.name = "Glass-fronted building at the end of Pegasus Drive";
  building.position.set(streetEndLayout.center[0], 0, streetEndLayout.center[1]); scene.add(building);
  const brick = new THREE.MeshStandardMaterial({ color: 0xffffff, map: brickMap(), bumpMap: brickMap(true), bumpScale: .035, roughness: .94 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x969a91, roughness: .96 });
  const silver = new THREE.MeshStandardMaterial({color:0xbfc8c6,metalness:.55,roughness:.4});
  const rubber = new THREE.MeshStandardMaterial({color:0x222826,roughness:.95});
  const yellow = new THREE.MeshStandardMaterial({color:0xd5b044,roughness:.92});
  const red = new THREE.MeshStandardMaterial({color:0x9f332c,roughness:.82});
  const white = new THREE.MeshStandardMaterial({color:0xf0eee1,roughness:.84});
  const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, at: [number,number,number], name: string) => {
    const mesh = new THREE.Mesh(geometry,material); mesh.position.set(...at); mesh.name=name;
    mesh.castShadow=mesh.receiveShadow=true; mesh.userData.exteriorWindowDetail=true; parent.add(mesh); return mesh;
  };
  const box = (parent: THREE.Object3D, size:[number,number,number], at:[number,number,number], material: THREE.Material, name:string) =>
    add(parent,stoneUVs(new THREE.BoxGeometry(...size),material===brick?2:4),material,at,name);
  const pane = (w:number,h:number,x:number,y:number,z=11.06,rows=3) => { const group=framedWindow(building,w,h,facade,rows); group.position.set(x,y,z); return group; };
  // Wide silver coping, cream left block, a broad gridded curtain wall, then
  // the projecting brick stair tower and recessed entrance visible in photos 3–4.
  box(building,[104,20,22],[0,10,0],brick,"Brick building shell");
  box(building,[104.7,.8,23],[-.1,20.4,0],facade.frame,"Continuous silver roof fascia");
  box(building,[102,.2,20],[0,20.95,0],roof,"Inset weathered roof");
  box(building,[18,16.1,.3],[-43,12.15,11.03],facade.stone,"Cream panel wing");
  for(const x of [-47,-41,-35]) for(const y of [8,13,17.5]) pane(.9,1.65,x,y,11.24,1);
  for(let x=-51;x<-33;x+=3) box(building,[.035,15.6,.07],[x,12,11.23],facade.frame,"Cream cladding joint");
  for(const y of [6,10,14,18]) box(building,[18,.035,.07],[-43,y,11.23],facade.frame,"Panel horizontal joint");
  for(let col=0;col<11;col++) pane(4.3,12.5,-30.6+col*4.36,12.7,11.12,9);
  box(building,[49,1.1,.65],[-8.8,5.75,11.1],facade.frame,"Curtain wall silver spandrel");
  box(building,[11,21.6,1.9],[21.8,10.8,11.2],brick,"Projecting stair tower");
  pane(6.35,18.7,20.95,10.25,12.19,13);
  pane(.95,16.8,25.96,11,12.19,9);
  box(building,[12,.32,2.4],[21.8,21.75,11.2],facade.stone,"Stair tower coping");
  box(building,[10,15.3,.26],[33.1,12.3,11.17],facade.recess,"Tall recessed entry slot");
  pane(5.4,13.6,33.1,12.2,11.33,8);
  box(building,[10.8,.7,2.1],[33.1,19.95,11.5],facade.frame,"Recessed entrance canopy");
  for(const x of [-47,-38,-29,-20,-11,-2,7,33,43,50]) {
    box(building,[.55,4.5,.7],[x-3.1,2.25,11.2],facade.stone,"Arcade stone pier");
    pane(5.4,3.8,x,2.45,11.25,2);
  }
  for(const x of [32,34]) { pane(1.8,3.1,x,1.65,11.42,2); box(building,[.06,.45,.12],[x+.55,1.6,11.58],silver,"Entrance pull handle"); }
  for(const x of [29.8,36.2]) {
    box(building,[.08,.9,.08],[x,.65,12.7],silver,"Accessible entry rail post");
    box(building,[.08,.07,3],[x,1.1,13],silver,"Entry handrail");
  }
  for(const x of [-37,2,42]) {
    box(building,[6,.45,3],[x,21.3,-4],roof,"Roof service unit");
    for(let row=0;row<7;row++) box(building,[5.6,.035,.05],[x,21.15+row*.06,-2.47],silver,"Mechanical grille");
  }
  // Extend the existing ground northward and connect a T junction. The new
  // building is beyond its cross street, never in the Engineering selection set.
  box(scene,[231,.02,62],[-21.5,-.052,-108],site.grass,"Rear campus lawn extension");
  const surface = (shape:THREE.Shape,y:number,material:THREE.Material,name:string) => {
    const geometry=new THREE.ShapeGeometry(shape,64); geometry.rotateX(-Math.PI/2); stoneUVs(geometry,material===site.asphalt?7:3.8);
    return add(scene,geometry,material,[0,y,0],name);
  };
  // Shape coordinates invert world Z. Rounded shoulders join both branches.
  const road=new THREE.Shape(); road.moveTo(-136,94); road.lineTo(94,94); road.lineTo(94,78); road.lineTo(-55,78);
  road.absarc(-55,73,5,Math.PI/2,Math.PI,false); road.lineTo(-60,77); road.lineTo(-76,77); road.lineTo(-76,73);
  road.absarc(-81,73,5,0,Math.PI/2,false); road.lineTo(-136,78); road.closePath();
  surface(road,-.014,site.asphalt,"Rear cross street with left and right turns");
  box(scene,[230,.13,3.6],[-21,.05,-97],site.concrete,"Sidewalk across the rear building");
  box(scene,[104,.12,2.6],[-68,.055,-100],site.concrete,"Building entrance walk");
  // Arc strips give both sidewalk corners a consistent raised, round curb.
  for(const [x,left] of [[-81,true],[-55,false]] as const) {
    const outer=left?Math.PI/2:Math.PI, inner=left?0:Math.PI/2;
    const strip=new THREE.Shape(); strip.absarc(x,73,1.5,inner,outer,false);
    strip.absarc(x,73,5,outer,inner,true); strip.closePath();
    surface(strip,.13,site.concrete,"Rounded junction sidewalk corner");
    const curb=new THREE.Shape(); curb.absarc(x,73,4.82,inner,outer,false); curb.absarc(x,73,5,outer,inner,true); curb.closePath();
    surface(curb,.18,site.curb,"Junction curved curb");
  }
  for(const [x,w] of [[-108.5,55],[19.5,149]]) {
    box(scene,[w,.12,3.5],[x,.055,-76.2],site.concrete,"Cross street south sidewalk");
    box(scene,[w,.18,.2],[x,.09,-78],site.curb,"Cross street edge curb");
  }
  box(scene,[230,.18,.2],[-21,.09,-95.1],site.curb,"Building-side curb");
  for(const x of [-68.2,-67.8]) box(scene,[.13,.018,5],[x,.025,-73.5],yellow,"Lane approach double yellow");
  for(const z of [-85.8,-86.2]) {
    box(scene,[54,.018,.13],[-109,.025,z],yellow,"Left cross street centerline");
    box(scene,[149,.018,.13],[19.5,.025,z],yellow,"Right cross street centerline");
  }
  for(let x=-74.8;x<-60;x+=2.6) box(scene,[1.1,.02,3.7],[x,.025,-80.4],site.paint,"Rear pedestrian crossing");
  box(scene,[15.4,.02,.3],[-68,.025,-76.4],site.paint,"Rear stop line");
  for(let x=-130;x<92;x+=4) box(scene,[.025,.018,3.5],[x,.13,-97],site.curb,"Rear sidewalk expansion joint");
  for(const x of [-83,-54]) {
    box(scene,[.7,.025,1.4],[x,.015,-78.5],facade.recess,"Junction drain");
    for(let i=0;i<8;i++) box(scene,[.6,.02,.045],[x,.035,-79+i*.15],silver,"Drain grate slot");
  }
  // Text is drawn on local canvases and stays legible at street camera distance.
  const signFace=(text:string,w:number,h:number,color:string,at:[number,number,number])=>{
    const canvas=document.createElement("canvas"); canvas.width=512;canvas.height=256;
    const ctx=canvas.getContext("2d"); if(!ctx)return;
    if(text!=="STOP") {ctx.fillStyle=color;ctx.fillRect(0,0,512,256);ctx.strokeStyle="#efeee0";ctx.lineWidth=8;ctx.strokeRect(8,8,496,240);}
    ctx.fillStyle="#efeee0";ctx.font='600 70px Inter, sans-serif';ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,256,128,475);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    add(scene,new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map,roughness:.85,transparent:text==="STOP"}),at,`${text} sign`);
  };
  add(scene,new THREE.CylinderGeometry(.04,.055,3.6,8),silver,[-57,1.8,-74],"Stop sign post");
  const stop=add(scene,new THREE.CylinderGeometry(.7,.7,.06,8),red,[-57,3.1,-74],"Octagonal stop sign");stop.rotation.x=Math.PI/2;stop.rotation.z=Math.PI/8;
  signFace("STOP",1.05,.62,"#9f332c",[-57,3.1,-73.955]);
  signFace("EXIT →",1.25,.65,"#324338",[-57,2.15,-73.95]);
  add(scene,new THREE.CylinderGeometry(.05,.07,4,8),silver,[-83,2,-70],"Wayfinding post");
  signFace("PEGASUS DR",1.8,.48,"#273b34",[-83,3.8,-69.95]);
  signFace("CROSSING",1.8,.48,"#273b34",[-83,3.2,-69.95]);
  for(const [x,z] of [[-93,-68],[-44,-66],[-119,-98],[-90,-98],[-46,-98],[-15,-98]]) {
    box(scene,[.55,.5,.55],[x,.25,z],site.curb,"Streetlight base");
    add(scene,new THREE.CylinderGeometry(.06,.1,6.4,10),silver,[x,3.65,z],"Disc lamp pole");
    add(scene,new THREE.ConeGeometry(.55,.2,24),silver,[x,6.95,z],"Disc lamp cap");
    add(scene,new THREE.CylinderGeometry(.28,.32,.2,16),white,[x,6.76,z],"Streetlight diffuser");
  }
  // Organic crowns are instanced; detailed bike components join static batches.
  const treeSites=[[-113,-68],[-88,-57],[-46,-58],[-34,-69],[-119,-100],[-101,-100],[-80,-100],[-57,-100],[-26,-100],[-8,-101]];
  const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.98}),treeSites.length*26);
  const transform=new THREE.Object3D();
  treeSites.forEach(([x,z],index)=>{
    add(scene,new THREE.CylinderGeometry(.16,.32,6.3,9),site.bark,[x,3.15,z],"Rear broadleaf trunk");
    add(scene,new THREE.CylinderGeometry(2.4,2.4,.025,32),site.mulch,[x,.012,z],"Tree mulch ring");
    for(let i=0;i<26;i++) {
      const a=i*2.39996,r=1.4+(i%4)*.6;
      transform.position.set(x+Math.cos(a)*r,6.5+(i%5)*.45,z+Math.sin(a)*r);
      transform.scale.set(1.7+(i%3)*.25,1.4,1.7);transform.updateMatrix();crowns.setMatrixAt(index*26+i,transform.matrix);
      crowns.setColorAt(index*26+i,new THREE.Color(i%3?0x426039:0x59723a));
    }
  });crowns.castShadow=crowns.receiveShadow=true;crowns.name="Rear layered broadleaf canopies";scene.add(crowns);
  for(let x=-116;x<-19;x+=1.4) if(x<-42||x>-29) box(scene,[1.5,1.15,1.25],[x,.58,-101.1],site.darkLeaf,"Facade hedge");
  const rod=(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material,name:string)=>{
    const direction=b.clone().sub(a);const mesh=add(parent,new THREE.CylinderGeometry(r,r,direction.length(),6),mat,a.clone().add(b).multiplyScalar(.5).toArray() as [number,number,number],name);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;
  };
  box(scene,[17,.1,4.4],[-38,.09,-62],site.concrete,"Engineering-side bicycle parking pad");
  for(let i=0;i<9;i++) {
    const x=-45+i*1.8;
    for(const z of [-63,-61]) add(scene,new THREE.CylinderGeometry(.045,.045,.85,8),silver,[x,.55,z],"Bicycle rack leg");
    const arch=add(scene,new THREE.TorusGeometry(1,.045,6,16,Math.PI),silver,[x,.97,-62],"Inverted U bicycle rack");arch.rotation.y=Math.PI/2;
    if(i===3)continue;
    const bike=new THREE.Group();bike.position.set(x+.2,0,-62);bike.rotation.y=.12*(i%3-1);scene.add(bike);
    const color=new THREE.MeshStandardMaterial({color:[0x526e86,0x853d35,0x5f6951][i%3],metalness:.45,roughness:.5});
    for(const z of [-.8,.8]) {
      const wheel=add(bike,new THREE.TorusGeometry(.48,.045,6,24),rubber,[0,.55,z],"Bicycle tire");wheel.rotation.y=Math.PI/2;
      const rim=add(bike,new THREE.TorusGeometry(.435,.018,5,24),silver,[0,.55,z],"Bicycle rim");rim.rotation.y=Math.PI/2;
      for(let spoke=0;spoke<12;spoke++) {const a=spoke*Math.PI/6;rod(bike,new THREE.Vector3(0,.55,z),new THREE.Vector3(0,.55+Math.cos(a)*.435,z+Math.sin(a)*.435),.008,silver,"Wheel spoke");}
    }
    const rear=new THREE.Vector3(0,.55,-.8),front=new THREE.Vector3(0,.55,.8),crank=new THREE.Vector3(0,.48,-.1),saddle=new THREE.Vector3(0,1.12,-.33),head=new THREE.Vector3(0,1.1,.56);
    for(const [a,b] of [[rear,crank],[rear,saddle],[saddle,crank],[saddle,head],[crank,head],[head,front]]) rod(bike,a,b,.035,color,"Bicycle frame tube");
    box(bike,[.3,.08,.25],[0,1.24,-.33],rubber,"Bicycle saddle");
    rod(bike,head,new THREE.Vector3(0,1.3,.6),.024,silver,"Handlebar stem");
    rod(bike,new THREE.Vector3(-.27,1.3,.6),new THREE.Vector3(.27,1.3,.6),.025,silver,"Bicycle handlebars");
    box(bike,[.38,.04,.12],[0,.46,-.1],silver,"Crank and pedals");
  }
}
