export interface MemoryNode {
  id:string;
  type:'memory'|'concept'|'artifact';
  title:string;
  confidence:number;
  relationships:string[];
}
