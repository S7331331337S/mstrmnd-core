export const tools = {
  get_identity(){
    return {status:'initialized'};
  },
  search_memory(query:string){
    return {query,results:[]};
  }
};

console.log('MSTRMND MCP SERVER ONLINE');
