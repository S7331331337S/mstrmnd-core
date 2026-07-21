export class MemoryEngine {
  search(query:string){
    return {query, memories:[]};
  }

  store(memory:unknown){
    return memory;
  }
}
