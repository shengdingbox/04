#!/usr/bin/env node
/**
 * license-keygen.cjs - 红果短剧激活码生成器（发码工具，给运营者用，不随应用分发）
 *
 * 用法：
 *   node scripts/license-keygen.cjs                 # 交互输入机器码
 *   node scripts/license-keygen.cjs XXXX-XXXX-XXXX-XXXX
 *   node scripts/license-keygen.cjs XXXXXXXXXXXXXXXX
 * 激活码密钥与 src/native/license.js 保持一致；更换需两边同步。
 */
const readline = require('readline');
const license = require('../src/native/license');

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

(async () => {
  let machineCode = process.argv[2];
  if (!machineCode) machineCode = await ask('请输入用户机器码（XXXX-XXXX-XXXX-XXXX）: ');
  try {
    const code = license.generateActivationCode(machineCode);
    console.log(`机器码 : ${machineCode}`);
    console.log(`激活码 : ${code}`);
  } catch (error) {
    console.error(`生成失败: ${error.message}`);
    process.exit(1);
  }
})();
