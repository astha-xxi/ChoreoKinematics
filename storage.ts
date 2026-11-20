import type { Formation, PoseFrame } from "../types";
const FORMATIONS="ck_formations_v1";
const REFERENCES="ck_references_v1";
export function loadFormations():Formation[]{try{return JSON.parse(localStorage.getItem(FORMATIONS)||"[]")}catch{return []}}
export function saveFormation(f:Formation){const all=loadFormations().filter(x=>x.id!==f.id);all.push(f);localStorage.setItem(FORMATIONS,JSON.stringify(all))}
export function loadReferences():Record<string,PoseFrame[]>{try{return JSON.parse(localStorage.getItem(REFERENCES)||"{}")}catch{return {}}}
export function saveReference(name:string,frames:PoseFrame[]){const all=loadReferences();all[name]=frames;localStorage.setItem(REFERENCES,JSON.stringify(all))}
