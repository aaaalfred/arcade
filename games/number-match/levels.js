/* Etapas deterministas. Cada una: semilla + n números iniciales + límite de 'añadir'.
 * Criterio: la semilla se eligió con gen-levels.js solo si el solver encontró una secuencia
 * completa de limpieza (replay verificado). solLen = longitud de esa solución. */
var D = (typeof window !== "undefined" ? window : globalThis); D.LEVELS_DATA = [{"id":1,"seed":1,"n":26,"adds":5,"solLen":21},{"id":2,"seed":1,"n":30,"adds":4,"solLen":37},{"id":3,"seed":1,"n":36,"adds":4,"solLen":33},{"id":4,"seed":1,"n":40,"adds":3,"solLen":30},{"id":5,"seed":1,"n":46,"adds":3,"solLen":33},{"id":6,"seed":1,"n":50,"adds":3,"solLen":52},{"id":7,"seed":1,"n":54,"adds":2,"solLen":35},{"id":8,"seed":1,"n":58,"adds":2,"solLen":39},{"id":9,"seed":1,"n":62,"adds":2,"solLen":41},{"id":10,"seed":1,"n":66,"adds":1,"solLen":41}];
if (typeof module !== 'undefined') module.exports = D.LEVELS_DATA;
