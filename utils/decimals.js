const bigDecimal = require('js-big-decimal');

// hastily written methods copied from SO to deal with
// the nuances of javascript in a hacky way.

module.exports = {

  d: (amount, decimals, precision) => {
    if (precision) {
      return module.exports.round(module.exports.weiToDisplay(amount, decimals), precision)
    }
    return module.exports.weiToDisplay(amount, decimals)
  },

  bigD: (value) => {
    let raw
    if (typeof value !== 'string') {
      raw = value.toString()
    } else {
      raw = value
    }
    return new bigDecimal(raw)
  },

  round: (_value, decimals) => {
    let value = _value
    if (typeof value !== 'string') {
      value = String(_value)
    }
    const d = module.exports.bigD(value)
    return d.round(decimals, bigDecimal.RoundingModes.FLOOR).getValue()
  },


  // convert wei to display, without using floating point math.
  weiToDisplay: (gwei, decimals) => {

    let acc = ''
    let g = String(gwei)
    if (typeof g === 'string' && g.length > 0) {
      if (g.length <= decimals) {
        g = g.padStart(decimals + 1, '0')
      }
      let index = g.length - decimals - 1;
      for (let i = 0; i < g.length; i++) {
        acc += g[i]
        if (index === i) {
          if (g[i] !== '.') {
            acc += '.'
          }
        }
      }

      // remove trailing zeroes after decimal point
      let finished = false
      for (let i = acc.length - 1; i > 0; i--) {
        if (acc[i] === '.' && !finished) {
          acc = acc.slice(0, acc.length - 1)
          finished = true
        }
        if (acc[i] !== '0') {
          finished = true
        }
        if (!finished) {
          acc = acc.slice(0, acc.length - 1)
        }
      }

      return acc

    } else {
      return 'Error'
    }
  },


  // convert display to gwei, without using floating point math.
  displayToWei: (display, decimals) => {

    let d = JSON.parse(JSON.stringify(display));

    // index of decimal point
    let floats;
    if (typeof d === 'string' && d.length > 0) {
      for (let i = 0; i < d.length; i++) {
        if (d[i] === '.') {
          floats = (d.length - 1) - i;
        }
      }

      // determine position of decimal point
      let offset;
      if (decimals < floats) { // chop off numbers that have more digits than decimals
        let diff = floats - decimals
        d = display.slice(0, display.length - diff)
        offset = 0;
      }
      else if (floats) {
        offset = decimals - floats
      } else {
        offset = decimals
      }

      // pad the end with zeroes and remove decimal point
      let acc = d;
      for (let i = 0; i < offset; i++) {
        acc += '0'
      }
      acc = acc.replace('.', '');

      // remove leading zeroes
      let acc2 = ''
      let done = false;
      for (let i = 0; i < acc.length; i++) {
        if (acc[i] !== '0') done = true;
        if (done) acc2 += acc[i];
      }

      // if nothing left, return zero
      if (acc2 === '') acc2 = '0'

      return acc2;
    } else {
      return 'Error'
    }
  },
  
  noExponents: (exponent) => {
    var data = String(exponent).split(/[eE]/);
    if (data.length === 1) return data[0];
    var z = '', sign = this < 0 ? '-' : '',
      str = data[0].replace('.', ''),
      mag = Number(data[1]) + 1;
    if (mag < 0) {
      z = sign + '0.';
      while (mag++) z += '0';
      return z + str.replace(/^\-/, '');
    }
    mag -= str.length;
    while (mag--) z += '0';
    return str + z;
  }

}

