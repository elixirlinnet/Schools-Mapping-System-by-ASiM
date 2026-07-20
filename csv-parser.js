(function(root, factory){
  if(typeof module === "object" && module.exports){
    module.exports = factory();
  }
  else{
    root.parseCsv = factory();
  }
})(typeof self !== "undefined" ? self : this, function(){
  function parseCsv(text){
    var rows = [];
    var row = [];
    var value = "";
    var inQuotes = false;

    for(var i = 0; i < text.length; i++){
      var ch = text[i];
      var next = text[i + 1];

      if(ch === '"' && inQuotes && next === '"'){
        value += '"';
        i++;
      }
      else if(ch === '"'){
        inQuotes = !inQuotes;
      }
      else if(ch === "," && !inQuotes){
        row.push(value);
        value = "";
      }
      else if((ch === "\n" || ch === "\r") && !inQuotes){
        if(ch === "\r" && next === "\n") i++;
        row.push(value);

        if(row.some(function(cell){ return cell.trim() !== ""; })){
          rows.push(row);
        }

        row = [];
        value = "";
      }
      else{
        value += ch;
      }
    }

    row.push(value);

    if(row.some(function(cell){ return cell.trim() !== ""; })){
      rows.push(row);
    }

    return rows;
  }

  return parseCsv;
});
