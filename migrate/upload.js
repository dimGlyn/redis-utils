#!/usr/bin/env node

/* eslint no-console: "off" */

const Redis = require('ioredis');
const fs = require('fs');
const {
  argv
} = require('yargs')
  .default('h', '127.0.0.1')
  .default('p', 6379)
  .default('d', 0)
  .default('filename', 'dump.json');

const host = argv.h;
const port = argv.p;
const db = argv.d;
const {
  filename
} = argv;

const startTime = new Date();
const promises = [];

const redis = new Redis({
  host,
  port,
  db
});

const dumpFile = fs.readFileSync(filename);
const data = JSON.parse(dumpFile);
try {
  data.forEach((chunk) => {
    const keys = Object.keys(chunk);
    keys.forEach((key) => {
      const {
        type,
        value
      } = chunk[key];
      switch (type) {
        case 'hash':
          promises.push(redis.hmset(key, value));
          break;
        case 'set':
          promises.push(redis.sadd(key, ...value));
          break;
        case 'list':
          promises.push(redis.lpush(key, ...value));
          break;
        case 'string':
          promises.push(redis.set(key, value));
          break;
        default:
          console.log('Lets also support', type);
      }
    });
  });
} catch (error) {
  console.log(error);
}

Promise.all(promises)
  .then((res) => {
    console.log(`Number of keys added: ${res.length}`);

    const executionTimeMs = new Date() - startTime;
    const executionTimeStr = millisecondsToStr(executionTimeMs);
    console.info(`\nExecution time: ${executionTimeStr}`);

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