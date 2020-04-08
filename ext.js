function seededRandom(seed) {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

Array.prototype.seededRandom = function (seed) {
    return this[Math.floor(seededRandom(seed) * this.length)];
};

Object.defineProperty(String.prototype, "hashCode", {
    value: function () {
        var hash = 0,
            i,
            chr;
        for (i = 0; i < this.length; i++) {
            chr = this.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    },
});