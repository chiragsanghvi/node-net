module.exports = {
	'firmwareVersion' : '1.0',
	'server-ip': '192.168.1.1',
	'file-path': './OATAPP/testDOTA.dwl',
	'username': 'admin',
	'password': '1qaz1qaz',
	'defaultRate': 10,
	'tcp-port': 8087,
	'http-port': 8083,
	'mapping-rate': {
		100: 10,
		90: 10,
		80: 10,
		70: 10,
		60: 10,
		50: 20,
		40: 60,
		30: 120,
		20: 300,
		10: 600
	},
	getTransferRate: function(message) {

		if (message && message.t == 3) return 2;

		message = message || {};
		var battery = message.b;
		
		if (!battery) return this.defaultRate;

		if (battery > 90) return this['mapping-rate'][100];
		else if (battery > 80) return this['mapping-rate'][90];
		else if (battery > 70) return this['mapping-rate'][80];
		else if (battery > 60) return this['mapping-rate'][70];
		else if (battery > 50) return this['mapping-rate'][60];
		else if (battery > 40) return this['mapping-rate'][50];
		else if (battery > 30) return this['mapping-rate'][40];
		else if (battery > 20) return this['mapping-rate'][30];
		else if (battery > 10) return this['mapping-rate'][20];
		else return this['mapping-rate'][10];
	}
};