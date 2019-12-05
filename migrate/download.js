#!/usr/bin/env node

/* eslint no-console: "off" */

const Redis = require('ioredis');
const fs = require('fs');
const { argv } = require('yargs')
  .default('h', '127.0.0.1')
  .default('p', 6379)
  .default('d', 0)
  .default('pattern', '*')
  .default('filename', 'dump.json');

const host = argv.h;
const port = argv.p;
const db = argv.d;
const { pattern } = argv;
const { filename } = argv;

let roundCount = 0;
let keyCount = 0;
let sep = '';
const startTime = new Date();

const redis = new Redis({
  host,
  port,
  db
});

// Delete previous file
if (fs.existsSync(filename)) {
  fs.unlinkSync(filename);
}

// Create new fil with '['
const fd = fs.openSync(filename, 'a');

fs.appendFileSync(fd, '[', 'utf8');

// Start scanning
const stream = redis.scanStream({
  match: pattern,
  count: 10000
});

// console.log(`\n*********** START SCANNING FOR PATTERN ${pattern} ***********`);

stream.on('data', async(resultKeys) => {
  roundCount += 1;
  // console.log(`\nFound ${resultKeys.length} keys on this round. Round count: ${roundCount}`);
  // Check if we have something to get
  if (resultKeys.length > 0) {
    // Pause scanning
    stream.pause();
    // console.log('Getting values');
    // console.log(resultKeys);
    try {
      const keyValues = await getValues(resultKeys);
      console.log(keyValues);
      keyCount += resultKeys.length;
      // console.log('Write key-values to file');
      // console.log(keyValues);
      fs.appendFileSync(fd, sep + JSON.stringify(keyValues), 'utf8');
      sep = ',';

      // Resume scanning
      stream.resume();
    } catch (err) {
      // console.log(`Error on mget: ${err}`);
      process.exit(1);
    }
  }
});
stream.on('end', () => {
  // console.log('\n*********** SCAN FINISHED ***********');

  // Close file
  fs.appendFileSync(fd, ']', 'utf8');
  if (fd !== undefined) {
    fs.closeSync(fd);
  }

  // Stop timer
  const executionTimeMs = new Date() - startTime;
  const executionTimeStr = millisecondsToStr(executionTimeMs);

  // Summary
  // console.log(`\nNumber of rounds: ${roundCount}`);
  // console.log(`Number of keyValues found: ${keyCount}`);
  // console.log(`Filename: ${filename}`);
  console.info(`Execution time: ${executionTimeStr}`);
  process.exit();
});

function millisecondsToStr(milliseconds) {
  function numberEnding(number) {
    return (number > 1) ? 's' : '';
  }

  let temp = Math.floor(milliseconds / 1000);

  const hours = Math.floor((temp %= 86400) / 3600);
  if (hours) {
    return `${hours} hour${numberEnding(hours)}`;
  }
  const minutes = Math.floor((temp %= 3600) / 60);
  if (minutes) {
    return `${minutes} minute${numberEnding(minutes)}`;
  }
  const seconds = temp % 60;
  if (seconds) {
    return `${seconds} second${numberEnding(seconds)}`;
  }
  return 'Less than a second';
}

async function getValues (resultKeys) {
  const keyValues = {};
  const types = [];
  const job = new Promise((resolve) => {
    resultKeys.forEach(async(key, i) => {
      const type = await redis.type(key);
      let value;
      if (type === 'hash') {
        value = redis.hgetall(key);
      } else {
        if (!types.includes(type)) {
          types.push(type);
        }
        value = redis.mget(key);
      }
      const keyValue = await value;
      keyValues[resultKeys[i]] = keyValue;
      if (i === resultKeys.length - 1) {
        resolve();
      }
    });
  });
  await job;
  return keyValues;
}