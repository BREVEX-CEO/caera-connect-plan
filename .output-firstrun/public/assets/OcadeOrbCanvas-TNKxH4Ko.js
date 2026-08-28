import{o as e}from"./rolldown-runtime-DAXXjFlN.js";import{i as t,t as n}from"./vendor-react-CX2mWblQ.js";import{H as r,br as i,vr as a,xr as o}from"./index-CCNlAlZM.js";import{i as s,n as c,t as l}from"./state-DxxN8SRV.js";var u=e(t(),1);function d(e,t,n){let{width:r,height:i}=n;if(e.clearRect(0,0,r,i),r<=0||i<=0)return;let a=r/2,o=i/2,s=Math.min(r,i)*.34*t.radius;if(s<=0)return;let c=f(t.core);f(t.rim);let l=e.createRadialGradient(a,o,s*.6,a,o,s*2.1);l.addColorStop(0,p(t.rim,.32*t.glow)),l.addColorStop(.55,p(t.rim,.1*t.glow)),l.addColorStop(1,p(t.rim,0)),e.fillStyle=l,e.beginPath(),e.arc(a,o,s*2.1,0,Math.PI*2),e.fill();let u=a-s*.35,d=o-s*.38,g=e.createRadialGradient(u,d,s*.08,a,o,s);g.addColorStop(0,m(c,.34)),g.addColorStop(.45,c),g.addColorStop(1,h(c,.55)),e.fillStyle=g,e.beginPath(),e.arc(a,o,s,0,Math.PI*2),e.fill(),e.strokeStyle=p(t.rim,.45+.4*t.glow),e.lineWidth=Math.max(1,s*.035),e.beginPath(),e.arc(a,o,s*.99,0,Math.PI*2),e.stroke()}function f(e){return`rgb(${_(e[0])}, ${_(e[1])}, ${_(e[2])})`}function p(e,t){return`rgba(${_(e[0])}, ${_(e[1])}, ${_(e[2])}, ${v(t).toFixed(3)})`}function m(e,t){return g(e,255,t)}function h(e,t){return g(e,0,t)}function g(e,t,n){let r=e.match(/\d+/g)?.map(Number)??[0,0,0],i=v(n),a=r.map(e=>Math.round(e+(t-e)*i));return`rgb(${a[0]}, ${a[1]}, ${a[2]})`}function _(e){return Math.max(0,Math.min(255,Math.round(v(e)*255)))}function v(e){return Number.isFinite(e)?Math.max(0,Math.min(1,e)):0}var y=`#version 100
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`,b=`#version 100
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;
uniform vec3  u_core;
uniform vec3  u_rim;
uniform float u_radius;
uniform float u_turbulence;
uniform float u_glow;

float surface(vec3 p) {
  float wobble =
      sin(p.x * 4.0 + u_time * 1.3)
    * sin(p.y * 4.0 - u_time * 1.1)
    * sin(p.z * 4.0 + u_time * 0.7);
  return length(p) - u_radius - wobble * u_turbulence * 0.06;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    surface(p + e.xyy) - surface(p - e.xyy),
    surface(p + e.yxy) - surface(p - e.yxy),
    surface(p + e.yyx) - surface(p - e.yyx)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  vec3 origin = vec3(0.0, 0.0, 2.6);
  vec3 direction = normalize(vec3(uv, -1.4));

  float travelled = 0.0;
  bool hit = false;
  for (int step = 0; step < 32; step++) {
    vec3 point = origin + direction * travelled;
    float distance = surface(point);
    if (distance < 0.002) { hit = true; break; }
    travelled += distance;
    if (travelled > 6.0) break;
  }

  // The halo is drawn whether or not the sphere was hit, so it survives at the
  // silhouette rather than clipping to a hard edge.
  float falloff = 1.0 - smoothstep(u_radius * 0.9, u_radius * 2.2, length(uv) * 2.6);
  vec3 colour = u_rim * falloff * u_glow * 0.35;
  float alpha = falloff * u_glow * 0.5;

  if (hit) {
    vec3 point = origin + direction * travelled;
    vec3 normal = normalAt(point);
    vec3 light = normalize(vec3(-0.55, 0.62, 0.75));
    float lambert = max(dot(normal, light), 0.0);
    float fresnel = pow(1.0 - max(dot(normal, -direction), 0.0), 2.5);
    colour = u_core * (0.22 + 0.78 * lambert) + u_rim * fresnel * (0.5 + u_glow);
    alpha = 1.0;
  }

  gl_FragColor = vec4(colour, alpha);
}
`;function x(e,t,n){return{resolution:n,time:t,core:e.core,rim:e.rim,radius:.62*e.radius,turbulence:e.turbulence,glow:e.glow}}function S(e){try{let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,depth:!1,failIfMajorPerformanceCaveat:!0,powerPreference:`low-power`})??null;return t?(t.getExtension(`WEBGL_lose_context`)?.loseContext(),!0):!1}catch{return!1}}var C=n();function w({state:e,amplitude:t=0,size:n=96,className:f,decorative:p=!1}){let m=(0,u.useRef)(null),h=o(),[g,_]=(0,u.useState)(`still`),v=(0,u.useRef)(t);v.current=t;let y=(0,u.useRef)(e);y.current=e;let b=h.reducedMotion||h.osReducedMotion;(0,u.useEffect)(()=>{let e=m.current;e&&_(s({reducedMotion:b,webglAvailable:S(e),lowEndDevice:a(i()).lowEnd||h.lowPerformance,smallViewport:typeof window<`u`&&window.innerWidth<768}))},[b,h.lowPerformance]),(0,u.useEffect)(()=>{let t=m.current;if(!t)return;let r=Math.min(2,typeof window>`u`?1:window.devicePixelRatio||1),i=Math.round(n*r);if(t.width=i,t.height=i,g===`still`){let n=t.getContext(`2d`);if(!n)return;d(n,c(e,0,{quality:`still`}),{width:i,height:i});return}if(g===`simple`){let e=t.getContext(`2d`);if(!e)return;let n=0,r=performance.now(),a=()=>{let t=(performance.now()-r)/1e3;d(e,c(y.current,t,{amplitude:v.current}),{width:i,height:i}),n=requestAnimationFrame(a)};return a(),()=>cancelAnimationFrame(n)}let a=t.getContext(`webgl`,{alpha:!0,antialias:!1,depth:!1,premultipliedAlpha:!1,powerPreference:`low-power`});if(!a){_(`simple`);return}let o=T(a);if(!o){_(`simple`);return}let s=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,s),a.bufferData(a.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),a.STATIC_DRAW);let l=a.getAttribLocation(o,`a_position`);a.enableVertexAttribArray(l),a.vertexAttribPointer(l,2,a.FLOAT,!1,0,0),a.useProgram(o),a.enable(a.BLEND),a.blendFunc(a.SRC_ALPHA,a.ONE_MINUS_SRC_ALPHA);let u=e=>a.getUniformLocation(o,e),f={resolution:u(`u_resolution`),time:u(`u_time`),core:u(`u_core`),rim:u(`u_rim`),radius:u(`u_radius`),turbulence:u(`u_turbulence`),glow:u(`u_glow`)},p=0,h=performance.now(),b=()=>{let e=(performance.now()-h)/1e3,t=x(c(y.current,e,{amplitude:v.current}),e,[i,i]);a.viewport(0,0,i,i),a.clearColor(0,0,0,0),a.clear(a.COLOR_BUFFER_BIT),a.uniform2f(f.resolution,t.resolution[0],t.resolution[1]),a.uniform1f(f.time,t.time),a.uniform3f(f.core,t.core[0],t.core[1],t.core[2]),a.uniform3f(f.rim,t.rim[0],t.rim[1],t.rim[2]),a.uniform1f(f.radius,t.radius),a.uniform1f(f.turbulence,t.turbulence),a.uniform1f(f.glow,t.glow),a.drawArrays(a.TRIANGLES,0,3),p=requestAnimationFrame(b)};b();let S=e=>{e.preventDefault(),cancelAnimationFrame(p),_(`simple`)};return t.addEventListener(`webglcontextlost`,S),()=>{cancelAnimationFrame(p),t.removeEventListener(`webglcontextlost`,S),a.getExtension(`WEBGL_lose_context`)?.loseContext()}},[g,n,e]);let w=(0,u.useMemo)(()=>l[e].label,[e]);return(0,C.jsxs)(`span`,{className:r(`relative inline-flex shrink-0`,f),style:{width:n,height:n},children:[(0,C.jsx)(`canvas`,{ref:m,"aria-hidden":!0,className:`h-full w-full`,style:{width:n,height:n}}),p?null:(0,C.jsx)(`span`,{role:`status`,"aria-live":`polite`,className:`sr-only`,children:w})]})}function T(e){let t=E(e,e.VERTEX_SHADER,y),n=E(e,e.FRAGMENT_SHADER,b);if(!t||!n)return null;let r=e.createProgram();return!r||(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))?null:r}function E(e,t,n){let r=e.createShader(t);return!r||(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))?null:r}export{w as OcadeOrbCanvas};