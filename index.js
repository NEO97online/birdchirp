#!/usr/bin/env node
/**
 * <: Birdchirp :>
 * Developed by Michael Auderer, aka Hermbit
 */

const Firestore = require('@google-cloud/firestore');
const firestore = new Firestore({
  projectId: 'birdchirp-testing',
  keyFilename: './birdchirp-testing-439c67a2e6b3.json'
});

const chirpRegex = /<: *(.+) *:>/g; // matches all chirps; $1 is the content of the chirp

let abort = false;

const fs = require('fs-extra');
const request = require('request');

/**
 * Replaces characters starting at a given index.
 * @param {*number} index The index of the string to start replacing at
 * @param {*string} replacement The string to insert at the given index
 */
String.prototype.replaceAt = function(index, replacement) {
  return this.substr(0, index) + replacement+ this.substr(index + replacement.length);
}

// The current path is modified by <: doc ... :> and <: col ... :> to change what we are accessing
let currentPath = '/';
let currentReq;

class Chirp {
  constructor(regexMatch) {
    this.raw = regexMatch[0];
    this.match = regexMatch[1].trim();
    this.index = regexMatch.index;
    this.testing = 'title';
  }

  requestData() {
    console.log('making request for ' + this.match);
    this.doBirdLogic(this.match)
    if (currentReq) {
      return currentReq
    } else {
      return new Promise(_ => console.log(_));
    }
    
  }
  
  doBirdLogic(bird) {
    if (bird.startsWith('doc')) {
      const path = bird.substr(4);
      currentPath = path;
      currentReq = firestore.doc(path).get();
      console.log('current path is now ' + currentPath);
      this.data = '<:doc:>';
      return currentReq;
    }
    else if (bird.startsWith('.')) {
      const field = bird.substr(1);
      if (currentPath === '/') {
        console.error('ABORTING: REQUESTED FIELD WITHOUT SELECTING DOCUMENT FIRST')
        process.exit(1);
      } else {
        currentReq.then(doc => {
          this.data = doc._fieldsProto[field].stringValue;
          return this.data;
        });
      }
    }
  }
}

/**
 * Finds all chirps in a file.
 */
function huntBirds(sourceFile, destFile) {
  fs.readFile(sourceFile, 'utf8', (err, data) => {
    if (err) return console.log(err);

    console.log('Hunting for birds...')
    const chirps = [];
    let match = chirpRegex.exec(data);
    while (match !== null && !abort) {
      console.log('Found bird: ' + match[1] + ' at index ' + match.index);
      chirps.push(new Chirp(match)); // create a new Chirp
      match = chirpRegex.exec(data);
    }
    console.log('Found ' + chirps.length + ' birds in file ' + sourceFile);

    console.log('Waiting for birds to chirp...');
    let chirpsToLoad = chirps.length;
    chirps.forEach(chirp => {
      chirp.requestData().then(_ => {
        chirpsToLoad--;
        if (chirp.data === '<:doc:>') {
          data = data.replace(chirp.raw, '');
        }
        else {
          data = data.replace(chirp.raw, chirp.data);
          console.log(chirp.raw + ' chirped "' + chirp.data + '"');
        } 

        if (chirpsToLoad === 0) {
          fs.outputFile(destFile, data, 'utf8', err => {
            if (err) return console.log(err);
            else console.log('Successfully chirped birds to file ' + destFile);
          });
        }
      })        
    });
  });
}

/**
 * The main chirp function of the CLI.
 * Finds birds in source files and builds to the /dist/ folder.
 */
function chirp() {
  huntBirds('src/index.html', 'dist/index.html');
}









chirp();