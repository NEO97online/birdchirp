module.exports = class BirdParser {
  constructor() { }
  parse(string, dataTree, debug) {
    this.dataTree = dataTree;
    // first, remove all refs, they should already be in the dataTree
    this.charArray = string.replace(/<: *(\S*) *={1} *(\S*) *:>/g, '').split('');
    // then, parse the data
    const tree = {};
    const buffer = [];
    let lastChar = '';
    let state = 'out'; // out, def, 
    let type = null;
    let currRef = null;
    let forVar = null;
    let forRef = null;
    let forArray = [];
    const varPath = [];
    let start = -1; // the starting index of a bird
    let end = -1; // the ending index of a bird
    let line = 0;
    let column = 0;
    for (let i = 0; i < this.charArray.length; i++) {
      const char = this.charArray[i];
      //if (debug) console.log('read: ' + char);
      column++;
      // newline
      if (char === '\n') {
        line++;
        column = 0;
        if (state !== 'forcontent') {
          continue;
        }
      }
      // <:
      else if (type === null && lastChar === '<' && char === ':') {
        if (state != 'def') {
          if (debug) console.log('new bird');
          state = 'def'; // open new bird
          start = i;
          type = null;
        } else {
          console.error(`[ERROR] Found an extra <: at line ${line} column ${column}`);
          continue;
        }
      }
      // var.path
      else if (state === 'def' && type === null && char !== ' ') {
        state = 'deftype';
        buffer.length = 0;
      }
      // open a for loop
      else if (state === 'deftype' && type === null && char === ' ') {
        if (buffer.join('') === 'for') {
          type = 'for';
          state = 'fordef';
          buffer.length = 0;
        }
      }
      // end of for var name
      else if (state === 'fordef' && char === ' ') {
        forVar = buffer.join('');
        state = 'forsep';
        buffer.length = 0;
      }
      // end of for separator
      else if (state === 'forsep' && char === ' ') {
        state = 'forref';
        buffer.length = 0;
      }
      // end of for reference
      else if (state === 'forref' && char === ':') {
        forRef = buffer.join('');
        forArray = dataTree[forRef];
        state = 'forcontent';
        buffer.length = 0;
        i++; // advance forward one to skip the ending >
        continue; // skip buffering this char
      }
      // end of for loop
      else if (state === 'forcontent' && char === '>' && buffer.join('').slice(-3) === '</:') {
        const bufferStr = buffer.join('');
        let forContent = bufferStr.substr(0, bufferStr.length-3);
        state = 'forend';
        end = i;
        const cleanupCount = end - start;
        const forResult = [];
        forArray.forEach(doc => {
          const regex = new RegExp(`<: *post *. *(\\w+?) *:>`, 'g');
          const content = forContent.replace(regex, (match, p1) => {
            return doc[p1];
          });
          forResult.push(content);
        });
        const result = forResult.join('\n');
        this.charArray.splice(start-1, cleanupCount+2, result);
        i = start + result.length;
        state = 'out';
        type = null;
        buffer.length = 0;
        forRef = null;
        forArray.length = 0;
      }
      // end of var name
      else if (state === 'deftype' && type === null && char === '.') {
        type = 'var';
        currRef = buffer.join('');
        buffer.length = 0; // clear the buffer
        state = 'varchild';
      }
      // end of variable node
      else if (state === 'varchild' && char === '.') {
        const node = buffer.join('');
        varPath.push(node); // push this node into the path stack
        buffer.length = 0; // clear the buffer
      }
      // end of variable path
      else if (state === 'varchild' && char === ':') {
        const node = buffer.join('');
        varPath.push(node);
        buffer.length = 0;
        state = 'end';
      }
      // end of bird
      else if (state === 'end' && char === '>') {
        end = i;
        if (debug) console.log(currRef, varPath);
        const data = dataTree[currRef][varPath[0]];
        const cleanupCount = end - start;
        this.charArray.splice(start-1, cleanupCount+2, data);
        i = start + data.length;
        if (debug) console.log(i);
        state = 'out';
        type = null;
        buffer.length = 0;
        currRef = null;
        varPath.length = 0;
      }
  
      // push the current char to the buffer
      if (state === 'forcontent' || char !== ' ') { // ignore whitespace
        lastChar = char;
        if (state === 'forcontent' || char !== '.') { // don't buffer periods
          buffer.push(char);
        }
      }
  
    }
    // resolve with the resulting parsed data
    return(this.charArray.join(''));
  }
}

/**
 * Finds all <: birds :> in a string, and replaces them with data from the given object.
 */
function parseBirds(string, dataTree, debug) {
  // then, parse the file data
  
}