import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {applyDocumentTheme,documentColorSchemes} from '../src/documentTheme.js'
import vm from 'node:vm'
test('tema explícito sincroniza documento, metadatos y barra del navegador',()=>{
  const tags={'meta[name="color-scheme"]':{},'meta[name="theme-color"]':{}}
  const doc={documentElement:{dataset:{}},querySelector:key=>tags[key]}
  applyDocumentTheme('dark',doc)
  assert.equal(doc.documentElement.dataset.appTheme,'dark')
  assert.equal(tags['meta[name="color-scheme"]'].content,'dark')
  applyDocumentTheme('light',doc)
  assert.equal(doc.documentElement.dataset.appTheme,'light')
  assert.equal(tags['meta[name="color-scheme"]'].content,'only light')
  assert.equal(tags['meta[name="theme-color"]'].content,'#f5f3ef')
})
test('sin metadatos no rompe y el acceso denegado a storage no impide aplicar el tema',()=>{
  const doc={documentElement:{dataset:{}},querySelector:()=>null}
  applyDocumentTheme('invalid',doc)
  assert.equal(doc.documentElement.dataset.appTheme,'light')
  const source=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(source,/applyDocumentTheme\(theme\)\s+try \{/)
})
test('formularios no reactivan un esquema forzado distinto al tema de la app',()=>{
  const css=readFileSync(new URL('../src/design-workspace.css',import.meta.url),'utf8')
  assert.match(css,/admin-panel.theme-light \{ color-scheme:only light/)
  assert.match(css,/admin-panel.theme-dark \{ color-scheme:only dark/)
  assert.doesNotMatch(readFileSync(new URL('../src/index.css',import.meta.url),'utf8'),/color-scheme:\s*dark\s*;/)
})
test('Samsung declara soporte nativo para ambos temas sin quitar la protección de Chrome',()=>{
  const samsung='Mozilla/5.0 (Linux; Android 16) SamsungBrowser/29.0 Chrome/130.0 Mobile Safari/537.36'
  const chrome='Mozilla/5.0 (Linux; Android 16; SM-S921B) Chrome/130.0 Mobile Safari/537.36'
  assert.equal(documentColorSchemes('light',samsung),'light dark')
  assert.equal(documentColorSchemes('dark',samsung),'light dark')
  assert.equal(documentColorSchemes('light',chrome),'only light')
  assert.equal(documentColorSchemes('dark',chrome),'dark')
  const tags={'meta[name="color-scheme"]':{},'meta[name="theme-color"]':{}}
  const doc={documentElement:{dataset:{}},defaultView:{navigator:{userAgent:samsung}},querySelector:key=>tags[key]}
  applyDocumentTheme('dark',doc)
  assert.equal(tags['meta[name="color-scheme"]'].content,'light dark')
  assert.equal(doc.documentElement.dataset.appTheme,'dark')
  applyDocumentTheme('light',doc)
  assert.equal(tags['meta[name="color-scheme"]'].content,'light dark')
  assert.equal(doc.documentElement.dataset.appTheme,'light')
})
test('el arranque antes de React y los cambios de tema usan la misma declaración',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8')
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1]
  for(const userAgent of ['SamsungBrowser/29.0','Chrome/130.0','Version/18.0 Safari/605.1'])for(const theme of ['light','dark']){
    const tags={'meta[name="color-scheme"]':{},'meta[name="theme-color"]':{}}
    const document={documentElement:{dataset:{}},querySelector:key=>tags[key]}
    vm.runInNewContext(script,{document,navigator:{userAgent},localStorage:{getItem:()=>theme}})
    assert.equal(tags['meta[name="color-scheme"]'].content,documentColorSchemes(theme,userAgent))
    assert.equal(document.documentElement.dataset.appTheme,theme)
  }
})
