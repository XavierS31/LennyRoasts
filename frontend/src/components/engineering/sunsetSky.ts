import * as THREE from "three";

/** A screen-filling, image-free sky. Clouds and glow are evaluated on the GPU. */
export function addSunsetSky(scene: THREE.Scene) {
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      aspect: { value: 1 },
      blue: { value: new THREE.Color("#5caee5") },
      paleBlue: { value: new THREE.Color("#acd4e5") },
      peach: { value: new THREE.Color("#ffc1a0") },
      coral: { value: new THREE.Color("#ff9b7b") },
      gold: { value: new THREE.Color("#ffd37e") },
      cream: { value: new THREE.Color("#fff1b1") },
      cloudShade: { value: new THREE.Color("#dd948b") },
      cloudLight: { value: new THREE.Color("#fff2cf") },
    },
    vertexShader: /* glsl */ `
      varying vec2 skyUV;
      void main() {
        skyUV = uv;
        // Keep the background stable through orbit, pan and all camera presets.
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float aspect;
      uniform vec3 blue, paleBlue, peach, coral, gold, cream;
      uniform vec3 cloudShade, cloudLight;
      varying vec2 skyUV;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
          mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), f.x), f.y);
      }

      float cloudNoise(vec2 p) {
        float value = 0.0;
        float weight = 0.54;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * weight;
          p = p * 2.07 + vec2(13.2, 7.1);
          weight *= 0.48;
        }
        return value;
      }

      void main() {
        vec2 uv = skyUV;
        // Broad continuous transitions: gold -> coral -> peach -> blue.
        vec3 sky = mix(gold, coral, smoothstep(0.50, 0.68, uv.y));
        sky = mix(sky, peach, smoothstep(0.64, 0.78, uv.y));
        sky = mix(sky, paleBlue, smoothstep(0.74, 0.90, uv.y));
        sky = mix(sky, blue, smoothstep(0.87, 1.0, uv.y));

        vec2 sunOffset = (uv - vec2(0.69, 0.69)) * vec2(aspect, 1.0);
        float sunDistance = length(sunOffset);
        float glow = exp(-sunDistance * sunDistance * 13.0);
        sky = mix(sky, cream, glow * 0.65);
        float halo = exp(-sunDistance * sunDistance * 170.0);
        sky = mix(sky, cloudLight, halo * 0.45);
        float disc = 1.0 - smoothstep(0.036, 0.040, sunDistance);
        sky = mix(sky, cream, disc);

        // Uneven, horizontally stretched banks with finer scalloped edges.
        vec2 p = vec2(uv.x * aspect * 4.0, uv.y * 9.0);
        float billows = cloudNoise(p + vec2(4.2, 1.7));
        float bank = smoothstep(0.29, 0.42, uv.y)
          * (1.0 - smoothstep(0.76, 0.96, uv.y));
        float opening = 1.0 - exp(-sunDistance * sunDistance * 36.0) * 0.72;
        float cloud = smoothstep(0.49, 0.66, billows) * bank * opening;

        // Light-facing rims stay cream; denser undersides pick up sunset peach.
        float above = cloudNoise(p + vec2(4.2, 1.84));
        float rim = clamp((billows - above) * 8.0 + 0.48, 0.0, 1.0);
        vec3 shade = mix(cloudShade, peach, smoothstep(0.5, 0.86, uv.y));
        vec3 clouds = mix(shade, cloudLight, rim * 0.78 + glow * 0.22);
        sky = mix(sky, clouds, cloud * 0.80);

        // Thin coral wisps below the larger banks, like the reference horizons.
        float wisps = cloudNoise(vec2(uv.x * aspect * 3.0, uv.y * 48.0) + 21.0);
        float wispBand = smoothstep(0.23, 0.36, uv.y)
          * (1.0 - smoothstep(0.52, 0.65, uv.y));
        sky = mix(sky, peach, smoothstep(0.59, 0.72, wisps) * wispBand * opening * 0.42);

        // Subtle dither prevents visible gradient banding without a texture.
        sky += (hash(gl_FragCoord.xy) - 0.5) / 512.0;
        gl_FragColor = vec4(sky, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  sky.name = "Procedural sunset sky";
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);
  return { resize: (width: number, height: number) => { material.uniforms.aspect.value = width / height; } };
}
