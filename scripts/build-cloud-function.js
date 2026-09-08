#!/usr/bin/env node
/*
 * 把 src/{data,utils,game-logic,mutators}.js 打包成一份 CommonJS 文件，供
 * cloudfunctions/applyGameAction/ 这个云函数 require() 使用。
 *
 * 为什么要单独打包一份：这几个文件本身是纯逻辑、不依赖浏览器 API，写的时候用的是
 * 浏览器原生 ES module（import/export），但腾讯云函数的 Node.js 运行时默认按
 * CommonJS 加载代码。这里用和以前 build.js（打包 Claude Artifact 单文件时）同样的
 * "去掉 import/export 关键字、按依赖顺序拼在一起"的笨办法，只是这次最后加一段
 * module.exports 而不是包进 IIFE。
 *
 * 每次改了 src/ 里这几个文件的游戏规则，要记得重新跑一次这个脚本，再把
 * cloudfunctions/applyGameAction/ 整个目录重新上传/部署到 CloudBase 控制台——
 * 云函数那边不会自动同步 src/ 的改动。
 *
 * 用法：node scripts/build-cloud-function.js
 */
"use strict";
var fs=require('fs');
var path=require('path');

var ROOT=path.join(__dirname,'..');
var SRC_DIR=path.join(ROOT,'src');
var OUT_DIR=path.join(ROOT,'cloudfunctions','applyGameAction');
var OUT_FILE=path.join(OUT_DIR,'game-logic-bundle.js');

/* 依赖顺序：被依赖的模块在前面 */
var MODULES=['data.js','utils.js','game-logic.js','mutators.js'];

function stripAndCollectExports(src){
  var noImports = src.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/[^'"]+['"];?/g, '');
  var names=[];
  var lines=noImports.split('\n');
  var out=[];
  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    var trimmed=line.trim();
    if(trimmed==='' && out.length && out[out.length-1]==='') continue;
    var m=trimmed.match(/^export\s+(?:function|var|const)\s+([A-Za-z0-9_$]+)/);
    if(m){
      names.push(m[1]);
      out.push(line.replace(/^(\s*)export\s+/, '$1'));
      continue;
    }
    out.push(line);
  }
  return { code: out.join('\n'), names: names };
}

function build(){
  var allNames=[];
  var parts=MODULES.map(function(file){
    var src=fs.readFileSync(path.join(SRC_DIR,file),'utf8');
    var res=stripAndCollectExports(src);
    allNames=allNames.concat(res.names);
    return '/* ---- src/'+file+' ---- */\n'+res.code.trim();
  });

  var body='"use strict";\n\n'+parts.join('\n\n')+'\n\nmodule.exports = {\n'+
    allNames.map(function(n){ return '  '+n+': '+n; }).join(',\n')+'\n};\n';

  fs.mkdirSync(OUT_DIR, {recursive:true});
  fs.writeFileSync(OUT_FILE, body);
  console.log('已生成 '+path.relative(ROOT,OUT_FILE)+'（'+allNames.length+' 个导出，'+body.split('\n').length+' 行）');
}
build();
