"""A typed 3D scene, rendered by the browser engine OCADE already ships (WebGL2).

The planner describes a scene as data: parts made of signed-distance shapes
(sphere, box, ellipsoid, cylinder, torus, capsule, half-space) combined by
union, smooth union, subtraction and intersection, with materials, lights, an
environment and a camera. This module compiles that data, and only numbers and
fixed names from it, into one fragment shader, then path-samples it in tiles:
soft shadows, ambient occlusion, glossy reflections, clear coat, depth of field.

Nothing here knows what is being built; there is no model of any object. The
scene file itself is the editable project: change it and render again.
"""

from __future__ import annotations

import base64
import math
import os

ENGINE = "ocade-sdf-webgl2/1"
TILE = 128

SHAPES = {
    # name: (GLSL call with {p}, number of size values)
    "sphere": ("length({p})-{0}", 1),
    "box": ("sdBox({p},vec3({0},{1},{2}))", 3),
    "ellipsoid": ("sdEllipsoid({p},vec3({0},{1},{2}))", 3),
    "cylinder": ("sdCylinder({p},{0},{1})", 2),
    "torus": ("sdTorus({p},{0},{1})", 2),
    "capsule": ("sdCapsule({p},{0},{1})", 2),
    "halfspace": ("{p}.y", 0),
}
PATTERNS = {"none": 0, "carbon": 1, "grille": 2, "brushed": 4}
OPS = {"union", "smooth_union", "subtract", "smooth_subtract", "intersect"}


def f(x: float) -> str:
    """A finite number as a GLSL float literal: the only way data reaches the shader."""
    x = float(x)
    if not math.isfinite(x):
        raise ValueError("non-finite number")
    return f"{x:.6f}"


def v3(values) -> str:
    return f"vec3({f(values[0])},{f(values[1])},{f(values[2])})"


def _rows(rotation) -> list[str] | None:
    """Rows of the inverse of an XYZ Euler rotation (degrees), applied to a point as dot products."""
    if not rotation or not any(rotation):
        return None
    x, y, z = (math.radians(a) for a in rotation)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    # R = Rz * Ry * Rx; its inverse is its transpose, so the rows of R^T are R's columns.
    r = [
        [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
        [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
        [-sy, cy * sx, cy * cx],
    ]
    return [v3([r[0][i], r[1][i], r[2][i]]) for i in range(3)]


def _place(var: str, node: dict) -> list[str]:
    """Mirror, then move, then rotate a point into a node's own frame."""
    lines = [f"{var}.{axis}=abs({var}.{axis});" for axis in node.get("mirror", [])]
    if node.get("position"):
        lines.append(f"{var}-={v3(node['position'])};")
    rows = _rows(node.get("rotation"))
    if rows:
        lines.append(f"{var}=vec3(dot({rows[0]},{var}),dot({rows[1]},{var}),dot({rows[2]},{var}));")
    return lines


def _reach(shape: dict) -> float:
    """A generous radius that contains the shape, for the part's bounding sphere."""
    size = max([abs(s) for s in shape.get("size", [])] or [0.0])
    extent = math.sqrt(3) * size + shape.get("round", 0) + shape.get("shell", 0)
    offset = shape.get("offset") or [0, 0, 0]
    position = shape.get("position") or [0, 0, 0]
    if shape.get("mirror"):
        position = [abs(c) for c in position]
    return math.dist(position, [0, 0, 0]) + math.dist(offset, [0, 0, 0]) + extent


def compile_map(scene: dict) -> str:
    materials = {m["id"]: i for i, m in enumerate(scene["materials"])}
    functions, calls = [], []
    for index, part in enumerate(scene["parts"]):
        body = []
        infinite = False
        for number, shape in enumerate(part["shapes"]):
            call, count = SHAPES[shape["shape"]]
            size = shape.get("size", [])
            if len(size) < count:
                raise ValueError(f"{shape['shape']} needs {count} size values")
            infinite |= shape["shape"] == "halfspace" and shape.get("op", "union") in ("union", "smooth_union")
            body.append("{vec3 s=q;")
            body += _place("s", shape)
            if shape.get("repeat"):
                axis = shape["repeat"]["axis"]
                plane = {"x": "yz", "y": "xz", "z": "xy"}[axis]
                body.append(f"s.{plane}=polar(s.{plane},{f(shape['repeat']['count'])});")
            if shape.get("offset"):
                body.append(f"s-={v3(shape['offset'])};")
            distance = call.format(*[f(v) for v in size[:count]], p="s")
            if shape.get("round"):
                distance = f"({distance})-{f(shape['round'])}"
            if shape.get("shell"):
                distance = f"abs({distance})-{f(shape['shell'])}"
            material = materials.get(shape.get("material"), -1)
            body.append(f"vec2 b=vec2({distance},{f(material)});")
            op, k = shape.get("op", "union"), f(max(shape.get("k", 0.05), 1e-4))
            if number == 0:
                body.append("a=b;}")
            else:
                body.append(
                    {
                        "union": "a=opU(a,b);}",
                        "smooth_union": f"a=opSU(a,b,{k});}}",
                        "subtract": "a=opS(a,b);}",
                        "smooth_subtract": f"a=opSS(a,b,{k});}}",
                        "intersect": "a=opI(a,b);}",
                    }[op]
                )
        reach = max(_reach(s) for s in part["shapes"])
        guard = "" if infinite else f"float bound=length(q)-{f(reach)};if(bound>0.3)return vec2(bound,-1.);"
        functions.append(f"vec2 part{index}(vec3 q){{{guard}vec2 a=vec2(1e9,-1.);" + "".join(body) + "return a;}")
        placed = "".join(_place("q", part))
        for instance in part.get("instances") or [[0, 0, 0]]:
            calls.append(f"{{vec3 q=p-{v3(instance)};{placed}r=opU(r,part{index}(q));}}")
    return "\n".join(functions) + "\nvec2 map(vec3 p){vec2 r=vec2(1e9,-1.);" + "".join(calls) + "return r;}"


def compile_shader(scene: dict) -> str:
    camera, environment, render = scene["camera"], scene["environment"], scene["render"]
    mats = []
    for m in scene["materials"]:
        emission = m.get("emission") or [0, 0, 0]
        mats.append(
            f"if(id=={f(len(mats))}){{c={v3(m['color'])};e={v3(emission)}*{f(m.get('emissionStrength', 1))};"
            f"metal={f(m.get('metallic', 0))};rough={f(max(m.get('roughness', 0.5), 0.02))};"
            f"coat={f(m.get('clearcoat', 0))};pat={PATTERNS[m.get('pattern', 'none')]};"
            f"scale={f(m.get('patternScale', 1))};}}"
        )
    lights = []
    for index, light in enumerate(scene.get("lights", [])):
        colour, soft = f"{v3(light['color'])}*{f(light['intensity'])}", f(light.get("softness", 0.05))
        if light["kind"] == "sun":
            lights.append(f"if(i=={index}){{l=normalize({v3(light['direction'])});dist=1e3;lc={colour};soft={soft};}}")
        else:
            lights.append(f"if(i=={index}){{vec3 d={v3(light['position'])}-p;dist=length(d);l=d/dist;"
                          f"lc={colour}/(1.+dist*dist);soft={soft};}}")
    boxes = []
    for box in environment.get("softboxes", []):
        boxes.append(f"col+=softbox(rd,normalize({v3(box['direction'])}),{f(math.radians(box['width']) / 2)},"
                     f"{f(math.radians(box['height']) / 2)})*{v3(box.get('color', [1, 1, 1]))}*{f(box['intensity'])};")
    floor = environment.get("floor")
    return SHADER.format(
        MAP=compile_map(scene),
        MATERIALS="".join(mats),
        LIGHTS="".join(lights),
        LIGHT_COUNT=len(lights),
        SOFTBOXES="".join(boxes),
        TOP=v3(environment["sky"][0]),
        HORIZON=v3(environment["sky"][1]),
        GROUND=v3(environment.get("ground", [0.02, 0.02, 0.02])),
        FLOOR=1 if floor else 0,
        FLOOR_COLOR=v3((floor or {}).get("color", [0, 0, 0])),
        FLOOR_ROUGH=f(max((floor or {}).get("roughness", 0.5), 0.02)),
        FLOOR_REFLECT=f((floor or {}).get("reflectance", 0.1)),
        CAM_POS=v3(camera["position"]),
        CAM_TARGET=v3(camera["target"]),
        FOV=f(math.tan(math.radians(camera["fov"]) / 2)),
        APERTURE=f(camera.get("aperture", 0)),
        FOCUS=f(camera.get("focusDistance", 0)),
        SAMPLES=int(render.get("samples", 4)),
        EXPOSURE=f(render.get("exposure", 1)),
    )


SHADER = """#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec2 uOffset;
out vec4 outColor;
float sdBox(vec3 p,vec3 b){{vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}}
float sdEllipsoid(vec3 p,vec3 r){{float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/max(k1,1e-6);}}
float sdCylinder(vec3 p,float r,float h){{vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}}
float sdTorus(vec3 p,float R,float r){{return length(vec2(length(p.xz)-R,p.y))-r;}}
float sdCapsule(vec3 p,float h,float r){{p.y-=clamp(p.y,-h,h);return length(p)-r;}}
vec2 polar(vec2 p,float n){{float a=6.2831853/n;float ang=atan(p.y,p.x)+a*.5;ang=mod(ang,a)-a*.5;return length(p)*vec2(cos(ang),sin(ang));}}
vec2 opU(vec2 a,vec2 b){{return a.x<b.x?a:b;}}
vec2 opI(vec2 a,vec2 b){{return vec2(max(a.x,b.x),(b.x>a.x&&b.y>=0.)?b.y:a.y);}}
vec2 opS(vec2 a,vec2 b){{float d=max(a.x,-b.x);return vec2(d,(-b.x>a.x&&b.y>=0.)?b.y:a.y);}}
vec2 opSU(vec2 a,vec2 b,float k){{float h=clamp(.5+.5*(b.x-a.x)/k,0.,1.);return vec2(mix(b.x,a.x,h)-k*h*(1.-h),h>.5?a.y:b.y);}}
vec2 opSS(vec2 a,vec2 b,float k){{float h=clamp(.5-.5*(a.x+b.x)/k,0.,1.);return vec2(mix(a.x,-b.x,h)+k*h*(1.-h),a.y);}}
{MAP}
float hash(vec2 p){{p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}}
vec2 rayFloor(vec3 ro,vec3 rd){{return ({FLOOR}==1&&rd.y<-1e-4)?vec2(-ro.y/rd.y,1.):vec2(1e9,0.);}}
vec2 march(vec3 ro,vec3 rd,float tmax,int steps){{float t=.01;for(int i=0;i<steps;i++){{vec2 h=map(ro+rd*t);if(h.x<.0004*t)return vec2(t,h.y);t+=h.x*.9;if(t>tmax)break;}}return vec2(1e9,-1.);}}
vec3 normalAt(vec3 p){{vec2 e=vec2(.0007,-.0007);return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}}
float shadow(vec3 ro,vec3 rd,float tmax,float soft){{float res=1.,t=.02;for(int i=0;i<56;i++){{float h=map(ro+rd*t).x;res=min(res,h/(soft*t));t+=clamp(h,.01,.4);if(res<.002||t>tmax)break;}}return clamp(res,0.,1.);}}
float occlusion(vec3 p,vec3 n){{float o=0.,s=1.;for(int i=1;i<=5;i++){{float h=.02+.09*float(i);o+=(h-map(p+n*h).x)*s;s*=.75;}}return clamp(1.-2.2*o,0.,1.);}}
float softbox(vec3 rd,vec3 dir,float w,float h){{vec3 r=normalize(cross(dir,abs(dir.y)>.99?vec3(1,0,0):vec3(0,1,0)));vec3 u=cross(r,dir);float c=dot(rd,dir);if(c<=0.)return 0.;vec2 a=vec2(atan(dot(rd,r),c),atan(dot(rd,u),c));vec2 q=abs(a)/vec2(w,h);return smoothstep(1.,.85,max(q.x,q.y));}}
vec3 env(vec3 rd){{vec3 col=rd.y>0.?mix({HORIZON},{TOP},pow(clamp(rd.y,0.,1.),.6)):mix({HORIZON},{GROUND},clamp(-rd.y*4.,0.,1.));{SOFTBOXES}return col;}}
void material(float id,vec3 p,vec3 n,out vec3 c,out vec3 e,out float metal,out float rough,out float coat){{
 c=vec3(.5);e=vec3(0);metal=0.;rough=.5;coat=0.;int pat=0;float scale=1.;
 {MATERIALS}
 vec3 w=abs(n);w/=(w.x+w.y+w.z);
 if(pat==1){{vec3 q=p*40.*scale;float t=0.;for(int i=0;i<3;i++){{vec2 uv=i==0?q.yz:i==1?q.xz:q.xy;vec2 c2=floor(uv);float tw=mod(c2.x+floor(c2.y*.5)*2.,4.)<2.?1.:0.;float lum=mix(.55,1.25,tw)*(.85+.15*sin(uv.x*3.1416));t+=lum*(i==0?w.x:i==1?w.y:w.z);}}c*=t;}}
 if(pat==2){{vec3 q=p*30.*scale;float t=0.;for(int i=0;i<3;i++){{vec2 uv=i==0?q.yz:i==1?q.xz:q.xy;uv.x+=mod(floor(uv.y),2.)*.5;vec2 f2=abs(fract(uv)-.5);t+=smoothstep(.32,.36,max(f2.x,f2.y))*(i==0?w.x:i==1?w.y:w.z);}}c*=mix(.05,1.,t);rough=mix(.9,rough,t);}}
 if(pat==4){{rough=mix(rough,rough*.5,.5+.5*sin(length(p.yz)*900.*scale));}}
}}
vec3 F(vec3 f0,float c){{return f0+(1.-f0)*pow(1.-c,5.);}}
vec3 direct(vec3 p,vec3 n,vec3 v,vec3 c,float metal,float rough){{
 vec3 acc=vec3(0);vec3 f0=mix(vec3(.04),c,metal);
 for(int i=0;i<{LIGHT_COUNT};i++){{
  vec3 l;float dist;vec3 lc;float soft;
  {LIGHTS}
  float nl=max(dot(n,l),0.);if(nl<=0.)continue;
  float sh=shadow(p+n*.002,l,min(dist,30.),soft);if(sh<=0.)continue;
  vec3 h=normalize(l+v);float nh=max(dot(n,h),0.);float a=rough*rough;
  float d=a*a/(3.1416*pow(nh*nh*(a*a-1.)+1.,2.));vec3 fr=F(f0,max(dot(h,v),0.));
  acc+=lc*sh*nl*((1.-fr)*(1.-metal)*c/3.1416+d*fr*.25);
 }}
 return acc;
}}
vec3 radiance(vec3 ro,vec3 rd,float seed){{
 vec3 col=vec3(0),weight=vec3(1);
 for(int bounce=0;bounce<3;bounce++){{
  vec2 h=march(ro,rd,bounce==0?80.:30.,bounce==0?260:140);vec2 fl=rayFloor(ro,rd);
  if(min(h.x,fl.x)>1e8){{col+=weight*env(rd);return col;}}
  bool floorHit=fl.x<h.x;float t=floorHit?fl.x:h.x;vec3 p=ro+rd*t;
  vec3 n=floorHit?vec3(0,1,0):normalAt(p);
  vec3 c,e;float metal,rough,coat;
  if(floorHit){{c={FLOOR_COLOR};e=vec3(0);metal=0.;rough={FLOOR_ROUGH};coat=0.;}}
  else material(h.y,p,n,c,e,metal,rough,coat);
  vec3 v=-rd;float nv=max(dot(n,v),0.);
  float ao=occlusion(p,n);if(floorHit)ao*=clamp(.35+.65*map(p).x*6.,.2,1.);
  vec3 f0=floorHit?vec3({FLOOR_REFLECT}):mix(vec3(.04),c,metal);
  vec3 fr=F(f0,nv)*(1.-rough*.6);
  vec3 amb=mix({HORIZON},{TOP},.5*n.y+.5)*.6+env(n)*.25;
  vec3 lit=direct(p,n,v,c,metal,rough)+amb*ao*(1.-metal)*c;
  float fc=F(vec3(.04),nv).x*coat;
  // one reflection lobe per sample: the sharp clear coat or the glossy base, by their weights
  bool coatLobe=hash(vec2(seed*1.7+float(bounce),p.x+p.z))<fc/(fc+max(fr.x,max(fr.y,fr.z))+1e-4);
  float spread=coatLobe?.02:rough*rough*1.2;
  vec3 jitter=vec3(hash(vec2(seed,p.x+float(bounce)))-.5,hash(vec2(p.y,seed))-.5,hash(vec2(p.z,seed+1.))-.5);
  vec3 r=normalize(reflect(rd,n)+jitter*spread);if(dot(r,n)<0.)r=reflect(rd,n);
  float fade=floorHit?exp(-.0015*t*t):1.;
  vec3 keep=(vec3(1)-fr)*(1.-fc);
  col+=weight*fade*(lit*keep+e)+(bounce==0?(1.-fade)*env(rd):vec3(0));
  weight*=fade*(fr+fc)*ao;
  if(max(weight.x,max(weight.y,weight.z))<.01)return col;
  ro=p+n*.003;rd=r;
 }}
 return col+weight*env(rd)*.5;
}}
vec3 aces(vec3 x){{return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}}
void main(){{
 vec2 px=gl_FragCoord.xy+uOffset;
 vec3 ro0={CAM_POS};vec3 fw=normalize({CAM_TARGET}-ro0);vec3 rt=normalize(cross(fw,vec3(0,1,0)));vec3 up=cross(rt,fw);
 vec3 col=vec3(0);
 for(int s=0;s<{SAMPLES};s++){{
  float seed=float(s)+1.;
  vec2 j=vec2(hash(px+seed*7.1),hash(px.yx+seed*3.7))-.5;
  vec2 uv=(2.*(px+j)-uRes)/uRes.y;
  vec3 rd=normalize(fw+{FOV}*(uv.x*rt+uv.y*up));vec3 ro=ro0;
  if({APERTURE}>0.){{float fd={FOCUS}>0.?{FOCUS}:length({CAM_TARGET}-ro0);vec3 focus=ro+rd*fd/dot(rd,fw);float a=6.2831*hash(px*1.3+seed);float r={APERTURE}*sqrt(hash(px*2.1+seed*1.7));ro+=(rt*cos(a)+up*sin(a))*r;rd=normalize(focus-ro);}}
  col+=radiance(ro,rd,seed+hash(px));
 }}
 col/=float({SAMPLES});
 col=aces(col*{EXPOSURE});col=pow(col,vec3(1./2.2));
 col+=(hash(px+.5)-.5)/255.;
 outColor=vec4(col,1.);
}}
"""

PAGE = """async ([source, width, height, tile]) => {
  const canvas = new OffscreenCanvas(tile, tile);
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) return { error: "no_webgl2" };
  const compile = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, "#version 300 es\\nin vec2 a;void main(){gl_Position=vec4(a,0,1);}"));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a");
  if (position < 0) throw new Error("missing_position_attribute");
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(program, "uRes"), width, height);
  globalThis.ocadeTile = (x, y) => {
    gl.uniform2f(gl.getUniformLocation(program, "uOffset"), x, y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw new Error("scene_draw_failed");
    const pixels = new Uint8Array(tile * tile * 4);
    gl.readPixels(0, 0, tile, tile, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw new Error("scene_readback_failed");
    if (!pixels.some((value, index) => index % 4 === 3 && value !== 0)) throw new Error("scene_empty_readback");
    let text = ""; for (let i = 0; i < pixels.length; i += 32768) text += String.fromCharCode(...pixels.subarray(i, i + 32768));
    return btoa(text);
  };
  return { renderer: gl.getParameter(gl.RENDERER) };
}"""


async def render(scene: dict, width: int, height: int):
    """Render the scene in tiles; return (renderer name, PIL image)."""
    from PIL import Image
    from playwright.async_api import async_playwright

    source = compile_shader(scene)
    async with async_playwright() as playwright:
        executable = os.environ.get("OCADE_BROWSER_EXECUTABLE")
        # Headless rendering needs no display; a stale DISPLAY would make Chromium drop WebGL.
        options = {"headless": True, "env": {k: v for k, v in os.environ.items() if k != "DISPLAY"}}
        if executable:
            browser = await playwright.chromium.launch(executable_path=executable, **options)
        else:
            try:
                browser = await playwright.chromium.launch(channel="msedge", **options)
            except Exception:
                browser = await playwright.chromium.launch(**options)
        try:
            page = await browser.new_page()
            await page.route("**/*", lambda route: route.abort())  # rendering needs no network
            ready = await page.evaluate(PAGE, [source, width, height, TILE])
            if "error" in ready:
                raise RuntimeError(ready["error"])
            image = Image.new("RGB", (width, height))
            for y in range(0, height, TILE):
                for x in range(0, width, TILE):
                    raw = base64.b64decode(await page.evaluate("([x, y]) => ocadeTile(x, y)", [x, y]))
                    tile = Image.frombytes("RGBA", (TILE, TILE), raw).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                    # WebGL rows start at the bottom: tile (x, y) covers image rows height-y-TILE .. height-y.
                    image.paste(tile.convert("RGB"), (x, height - y - TILE))
            return ready["renderer"], image
        finally:
            await browser.close()
