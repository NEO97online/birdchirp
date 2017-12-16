#!/usr/bin/env node
/**
 * <: Birdchirp :>
 * Developed by Michael Auderer, aka Hermbit
 */

const fs = require('fs-extra');
const spinner = require('ora')({ spinner: 'dots' });
const perfy = require('perfy');

const Firestore = require('@google-cloud/firestore');
const firestore = new Firestore({
  projectId: 'birdchirp-testing',
  keyFilename: './birdchirp-testing-439c67a2e6b3.json'
});

/**
 * Runs a function for each match of the regex found in the given string.
 * @param {*string} string The string to run the regex on.
 * @param {*function} callback The function to run for each result found.
 */
RegExp.prototype.forEach = function(string, callback) {
  let match = this.exec(string);
  while (match != null) {
    callback(match);
    match = this.exec(string);
  }
}

/**
 * Returns a regex that finds each Firestore reference.
 * $1: The variable name for this ref
 * $2: the path of this ref
 */
function createRefRegex() {
  return /<: *(\S*) *={1} *(\S*) *:>/g;
}

/**
 * Returns a regex that finds a variable chirp.
 * $1: The variable path inside the chirp.
 */
function createVarRegex() {
  return /<: *(\w+\.\w+) *:>/g;
}

/**
 * Returns a new regex to hunt for birds.
 * $1: The type of bird, i.e. 'doc' or 'col'
 * $2: The path of the bird, i.e. '/posts/post'
 * $3: The HTML content of the bird
 */
function createBirdRegex() {
  return /<: *(\S*) *(\S*) *:>([\s\S]*?)<\/:>/g;
}

function createChirpRegex() {
  //
}

/**
 * Replaces all chirps with their proper data and returns the result.
 */
function parseChirps(fileString, chirpData) {
  return new Promise((resolve, reject) => {
    spinner.start('Parsing file with retrieved chirps...');
    // first, remove all firestore refs, they should already be in chirpData
    let result = fileString.replace(createRefRegex(), '');
    // then, replace all variables
    const regex = createVarRegex();
    regex.forEach(fileString, match => {
      const raw  = match[0];
      const path = match[1];
      const data = path.split('.').reduce((a, b) => a[b], chirpData);
      result = result.replace(raw, data);
    });
    // resolve with the resulting parsed data
    resolve(result);
  }).catch(reason => spinner.fail(reason));
}

/**
 * Returns a bird ref object from a given regex match.
 * @param {*RegExpExecArray} regexMatch The result of calling .exec on the regex
 */
function getChirpRef(regexMatch) {
  const chirpRef = {
    raw:  regexMatch[0],
    name: regexMatch[1],
    path: regexMatch[2],
  }
  // return the found chirp
  return chirpRef;
}

function loadRefs(fileData) {
  return new Promise((resolve, reject) => {
    // Find all Firestore references
    const chirpResults = {};
    let remaining = 0;
    const regex = createRefRegex();
    regex.forEach(fileData, match => {
      const chirpRef = getChirpRef(match);
      remaining++;
      spinner.start(`Loading chirp '${chirpRef.name}' from '${chirpRef.path}`);
      // Request the chirp's data from Firestore
      firestore.doc(chirpRef.path).get()
        .then(docSnapshot => {
          const data = docSnapshot.data();
          chirpResults[chirpRef.name] = data;
          remaining--;
          spinner.info(`Retrieved chirp: ${JSON.stringify(data)}`);
          if (remaining === 0) {
            spinner.succeed('Successfully retrieved all chirps!');
            resolve(chirpResults);
          }
        });
    });
  });
}

function readFile(sourceFile) {
  return new Promise((resolve, reject) => {
    spinner.start(`Reading file ${sourceFile}...`);
    fs.readFile(sourceFile, 'utf8', (err, fileData) => {
      if (err) {
        spinner.fail(err.message);
        reject(err);
      } else {
        spinner.succeed(`Opened file ${sourceFile}`)
        resolve(fileData);
      }
    });
  })
}

/**
 * The main chirp function of the CLI.
 * Finds birds in source files and builds to the /dist/ folder.
 */
function chirp(sourceFile, destFile) {
  perfy.start('chirp');
  
  let data = '';
  // read the source file
  readFile(sourceFile)
  // load the references from Firestore
  .then(fileData => {
    data = fileData;
    return loadRefs(data);
  })
  // replace variables with those from the retrieved data
  .then(chirpResults => parseChirps(data, chirpResults))
  .then(resultString => {
    spinner.start(`Writing parsed chirps to ${destFile}...`);
    return fs.outputFile(destFile, resultString);
  })
  .then(_ => {
    const time = perfy.end('chirp').time;
    spinner.succeed(`Finished chirping in ${time}s!`)
  });
}

// Run the program
chirp('src/index.html', 'dist/index.html');