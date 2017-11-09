module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
	networks: {
		development: {
			host: "localhost",
			port: 8545,
			network_id: "*", // match any network
			gas: 6000000
		},
		rinkeby: {
			host: 'localhost',
			port: 8545,
			network_id: '4',
			// from: '0x0' // optional
			gas: 6000000
		}
	}
};
