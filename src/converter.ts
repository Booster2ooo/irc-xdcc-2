export const converter = {
	intToIp(numIp: string) {
        var octets = []
		  , number = parseInt(numIp,10)
		  ;
		if (numIp.indexOf(':') > -1) { // IPv6
			return numIp;
		}
        octets.unshift(number & 255);
        octets.unshift((number >> 8) & 255);
        octets.unshift((number >> 16) & 255);
        octets.unshift((number >> 24) & 255);
        return octets.join('.');
	}
};