#!/usr/bin/env node
import {run} from '../src/core.js';
run(process.argv.slice(2)).catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
