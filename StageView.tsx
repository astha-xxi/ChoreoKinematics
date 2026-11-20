import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Point3, Dancer } from "../types";

const CONNECTIONS:number[][] = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
export default function StageView({landmarks,dancers,mode="pose"}:{landmarks:Point3[];dancers:Dancer[];mode?:"pose"|"stage"}){
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!host.current)return;
    const el=host.current, scene=new THREE.Scene(); scene.background=new THREE.Color("#151b17");
    const camera=new THREE.PerspectiveCamera(42,el.clientWidth/Math.max(el.clientHeight,1),.1,100);
    camera.position.set(0,4.2,7.8); camera.lookAt(0,1,0);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(el.clientWidth,el.clientHeight); el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x354238,2));
    const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,6,4);scene.add(light);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(8,6),new THREE.MeshStandardMaterial({color:"#28342d",roughness:.9,side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;scene.add(floor);
    const grid=new THREE.GridHelper(8,16,"#60766a","#34463a");grid.position.y=0;scene.add(grid);
    const material=new THREE.MeshStandardMaterial({color:"#d4e7d4",emissive:"#49664e",emissiveIntensity:.4});
    const jointGeo=new THREE.SphereGeometry(.055,12,12);
    const bones:THREE.Mesh[]=[];
    const addBone=(a:THREE.Vector3,b:THREE.Vector3)=>{
      const d=new THREE.Vector3().subVectors(b,a), mesh=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1,8),material);
      mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=d.length();mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());scene.add(mesh);bones.push(mesh);
    };
    if(mode==="pose"&&landmarks.length>=33){
      const pts=landmarks.map(p=>new THREE.Vector3(p.x*2.8,Math.max(.05,p.y*2.8+1.2),p.z*2.8));
      CONNECTIONS.forEach(([a,b])=>addBone(pts[a],pts[b]));
      pts.forEach(p=>{const m=new THREE.Mesh(jointGeo,material);m.position.copy(p);scene.add(m);bones.push(m)});
    } else {
      dancers.forEach((d,i)=>{
        const group=new THREE.Group();
        const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.85,16),new THREE.MeshStandardMaterial({color:d.color}));
        body.position.y=.55;group.add(body);
        const head=new THREE.Mesh(new THREE.SphereGeometry(.13,16,16),new THREE.MeshStandardMaterial({color:"#eadfcf"}));head.position.y=1.08;group.add(head);
        group.position.set(d.x-4,0,d.z-3);scene.add(group);bones.push(body,head);
      });
      // audience-facing marker
      const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,.02,2.6),1,"#d7c99c");scene.add(arrow);
    }
    const render=()=>renderer.render(scene,camera);render();
    const resize=()=>{if(!host.current)return;camera.aspect=host.current.clientWidth/Math.max(host.current.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(host.current.clientWidth,host.current.clientHeight);render()};
    const observer=new ResizeObserver(resize);observer.observe(el);
    return()=>{observer.disconnect();renderer.dispose();el.replaceChildren();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const m=o.material;if(Array.isArray(m))m.forEach(x=>x.dispose());else m.dispose()}})};
  },[landmarks,dancers,mode]);
  return <div className="three-host" ref={host}/>;
}
