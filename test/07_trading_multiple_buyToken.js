let fixedSupplyToken = artifacts.require('./FixedSupplyToken.sol');
let exchange = artifacts.require('./Exchange.sol');

contract('Buy Multiple Token Tests', function(accounts) {

	let exchangeInstance;
	let ethAccount0initialBalance;
	let ethAccount1initialBalance;
	let tokenAccount0initialBalance;
	let tokenAccount1intiialBalance;

	before(function() {
		let instanceExchange;
		let instanceToken;
		return exchange.deployed().then(function (instance) {
			instanceExchange = instance;
			return instanceExchange.depositEther({from: accounts[0], value: web3.toWei(10, "ether")});
		}).then(function(txResult) {

			return fixedSupplyToken.deployed();
		}).then(function(myTokenInstance) {
			instanceToken = myTokenInstance;
			return instanceExchange.addToken("FIXED", instanceToken.address);
		}).then(function(txResult) {
			return instanceToken.transfer(accounts[1], 2000);
		}).then(function(txResult) {
			return instanceToken.approve(instanceExchange.address, 2000, {from: accounts[1]});
		}).then(function(txResult) {
			return instanceExchange.depositToken("FIXED", 2000, {from: accounts[1]});
		});
	});

	beforeEach(function() {

		return exchange.deployed().then(function(instance) {
			exchangeInstance = instance;
			return exchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function(balance) {
			tokenAccount0initialBalance = balance.toNumber();
			return exchangeInstance.getBalance('FIXED', {from: accounts[1]});
		}).then(function(balance) {
			tokenAccount1intiialBalance = balance.toNumber();
			return exchangeInstance.getEthBalanceInWei({from: accounts[0]});
		}).then(function(balance) {
			ethAccount0initialBalance = balance.toNumber();
			return exchangeInstance.getEthBalanceInWei({from: accounts[1]});
		}).then(function(balance) {
			ethAccount1initialBalance = balance.toNumber();
		})

	});

	it ("should be able to buy out completely multiple sell offers", function() {

		return exchangeInstance.sellToken('FIXED', web3.toWei(1, "finney"), 5, {from: accounts[1]})
			.then(function(txResult) {
				assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
				assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
				return exchangeInstance.sellToken('FIXED', web3.toWei(2, "finney"), 10, {from: accounts[1]});
			}).then(function(txResult) {
				assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
				assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
				return exchangeInstance.sellToken('FIXED', web3.toWei(3, "finney"), 15, {from: accounts[1]});
			}).then(function(txResult) {
				assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
				assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
				return exchangeInstance.getSellOrderBook('FIXED');
			}).then(function (orderBook) {
				assert.equal(orderBook[0].length, 3, "OrderBook should have 3 sell offers");
				assert.equal(orderBook[1].length, 3, "OrderBook should have 3 sell volume elementS");
				assert.equal(orderBook[0][2].toNumber(), web3.toWei(1, "finney"), "price of entry 1 should be 1 finney");
				assert.equal(orderBook[0][1].toNumber(), web3.toWei(2, "finney"), "price of entry 2 should be 2 finney");
				assert.equal(orderBook[0][0].toNumber(), web3.toWei(3, "finney"), "price of entry 3 should be 3 finney");
				assert.equal(orderBook[1][2].toNumber(), 5, "OrderBook entry 1 should have a volume of 5 coins someone wants to sell");
				assert.equal(orderBook[1][1].toNumber(), 10, "OrderBook entry 2 should have a volume of 10 coins someone wants to sell");
				assert.equal(orderBook[1][0].toNumber(), 15, "OrderBook entry 3 should have a volume of 5 coins someone wants to sell");
				return exchangeInstance.buyToken("FIXED", web3.toWei(8, "finney"), 30);
			}).then(function(txResult) {
				assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
				assert.equal(txResult.logs[0].event, "BuyOrderFulfilled", "The Log-Event should be BuyOrderFulfilled");
				return exchangeInstance.getBuyOrderBook.call("FIXED");
			}).then(function(orderBook) {
				assert.equal(orderBook[0].length, 0, "OrderBook should have 0 buy offers");
				assert.equal(orderBook[1].length, 0, "OrderBook should have 0 buy volume has one element");
				return exchangeInstance.getSellOrderBook.call("FIXED");
			}).then(function(orderBook) {
				assert.equal(orderBook[0].length, 0, "OrderBook should have 0 sell offers");
				assert.equal(orderBook[1].length, 0, "OrderBook should have 0 sell volume elements");

				// Check the balances
				return exchangeInstance.getBalance('FIXED', {from: accounts[0]});
			}).then(function(balance) {
				assert(balance.toNumber() - tokenAccount0initialBalance, 30, "Account 0 should have 30 more tokens than before.");
				return exchangeInstance.getBalance('FIXED', {from: accounts[1]});
			}).then(function(balance) {
				assert(tokenAccount1intiialBalance - balance.toNumber(), 30, "Account 1 should be 30 tokens poorer.");
				return exchangeInstance.getEthBalanceInWei({from: accounts[0]});
			}).then(function(balance) {
				assert(ethAccount0initialBalance - balance.toNumber(), web3.toWei(70, "finney"), "Account 0 should be 70 finney poorer.");
				return exchangeInstance.getEthBalanceInWei({from: accounts[1]});
			}).then(function(balance) {
				assert(balance.toNumber() - ethAccount1initialBalance, web3.toWei(70, "finney"), "Account 1 should be 70 finney richer.");
			})

	});

	it ("should be able to buy out completely multiple sell offers and create a limit buy order", function() {

		return exchange.deployed().then(function (instance) {
			exchangeInstance = instance;
			return exchangeInstance.sellToken('FIXED', web3.toWei(1, "finney"), 5, {from: accounts[1]})
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
			return exchangeInstance.sellToken('FIXED', web3.toWei(2, "finney"), 10, {from: accounts[1]});
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
			return exchangeInstance.sellToken('FIXED', web3.toWei(3, "finney"), 15, {from: accounts[1]});
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
			return exchangeInstance.getSellOrderBook.call('FIXED');
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 3, "OrderBook should have 3 sell offers");
			assert.equal(orderBook[1].length, 3, "OrderBook should have 3 sell volume elementS");
			assert.equal(orderBook[0][2].toNumber(), web3.toWei(1, "finney"), "price of entry 1 should be 1 finney");
			assert.equal(orderBook[0][1].toNumber(), web3.toWei(2, "finney"), "price of entry 2 should be 2 finney");
			assert.equal(orderBook[0][0].toNumber(), web3.toWei(3, "finney"), "price of entry 3 should be 3 finney");
			assert.equal(orderBook[1][2].toNumber(), 5, "OrderBook entry 1 should have a volume of 5 coins someone wants to sell");
			assert.equal(orderBook[1][1].toNumber(), 10, "OrderBook entry 2 should have a volume of 10 coins someone wants to sell");
			assert.equal(orderBook[1][0].toNumber(), 15, "OrderBook entry 3 should have a volume of 5 coins someone wants to sell");
			return exchangeInstance.buyToken("FIXED", web3.toWei(8, "finney"), 40);
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "The Log-Event should be LimitBuyOrderCreated");
			return exchangeInstance.getBuyOrderBook.call("FIXED");
		}).then(function(orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 buy offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 buy volume");
			assert.equal(orderBook[0][0], web3.toWei(8, "finney"), "New buy order should be listed for 8 finney");
			assert.equal(orderBook[1][0], 10, "New buy order should be for 10 tokens.");
			return exchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function(orderBook) {
			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 sell offers");
			assert.equal(orderBook[1].length, 0, "OrderBook should have 0 sell volume elements");

			// Check the balances
			return exchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function(balance) {
			assert(balance.toNumber() - tokenAccount0initialBalance, 30, "Account 0 should have 30 more tokens than before.");
			return exchangeInstance.getBalance('FIXED', {from: accounts[1]});
		}).then(function(balance) {
			assert(tokenAccount1intiialBalance - balance.toNumber(), 30, "Account 1 should be 30 tokens poorer.");
			return exchangeInstance.getEthBalanceInWei({from: accounts[0]});
		}).then(function(balance) {
			assert(ethAccount0initialBalance - balance.toNumber(), web3.toWei(70, "finney"), "Account 0 should be 70 finney poorer.");
			return exchangeInstance.getEthBalanceInWei({from: accounts[1]});
		}).then(function(balance) {
			assert(balance.toNumber() - ethAccount1initialBalance, web3.toWei(70, "finney"), "Account 1 should be 70 finney richer.");
		})

	});



});