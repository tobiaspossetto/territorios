import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToString} from 'react-dom/server'
import {useCalendarState} from 'react-stately/useCalendarState'
import {createCalendar,parseDate} from '@internationalized/date'
import {dateFieldRange} from '../src/dateFieldRange.js'

function FocusProbe(props) {
  const calendar=useCalendarState({locale:'es-AR',createCalendar,value:null,...props})
  return React.createElement('span',null,calendar.focusedDate.toString())
}
const renderRange=props=>renderToString(React.createElement(FocusProbe,props))

test('reproduce el error 301 del calendario vacío cuando inicio supera el máximo',()=>{
  assert.throws(()=>renderRange({minValue:parseDate('2026-11-04'),maxValue:parseDate('2026-11-03')}),/Too many re-renders/)
})
test('el rango protegido no provoca el bucle y conserva el límite superior',()=>{
  const range=dateFieldRange('2026-11-04','2026-11-03')
  assert.equal(range.conflict,true)
  assert.equal(range.minValue,undefined)
  assert.equal(range.maxValue.toString(),'2026-11-03')
  assert.doesNotThrow(()=>renderRange(range))
})
test('fin vacío normal y fechas iguales mantienen sus restricciones',()=>{
  for(const [min,max] of [['2026-09-24','2026-11-03'],['2026-11-03','2026-11-03']]){
    const range=dateFieldRange(min,max)
    assert.equal(range.conflict,false)
    assert.equal(range.minValue.toString(),min)
    assert.equal(range.maxValue.toString(),max)
    assert.doesNotThrow(()=>renderRange(range))
  }
})
test('campos sin fechas o con límites ilegibles abren sin intervalo imposible',()=>{
  for(const [min,max] of [[undefined,undefined],['','2026-11-03'],['no es fecha','']]){
    const range=dateFieldRange(min,max)
    assert.equal(range.conflict,false)
    assert.doesNotThrow(()=>renderRange(range))
  }
})
test('corregir el inicio vuelve a habilitar el campo sin alterar ningún registro',()=>{
  const record={inicio:'2026-11-04',fin:null}
  assert.equal(dateFieldRange(record.inicio,'2026-11-03').conflict,true)
  assert.deepEqual(record,{inicio:'2026-11-04',fin:null})
  assert.equal(dateFieldRange('2026-11-02','2026-11-03').conflict,false)
})
