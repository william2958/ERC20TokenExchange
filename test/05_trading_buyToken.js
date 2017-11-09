let fixedSupplyToken = artifacts.require("./FixedSupplyToken.sol");
let exchange = artifacts.require("./Exchange.sol");

contract('Buy Token Tests', function (accounts) {
	before(function() {
		let instanceExchange;
		let instanceToken;
		return exchange.deployed().then(function (instance) {
			instanceExchange = instance;
			return instanceExchange.depositEther({from: accounts[0], value: web3.toWei(3, "ether")});
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

	it("should be possible to add fully fulfill buy orders", function () {
		let myExchangeInstance;
		return exchange.deployed().then(function (instance) {
			myExchangeInstance = instance;
			return myExchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook.length, 2, "getSellOrderBook should have 2 elements");
			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 sell offers");
			return myExchangeInstance.sellToken("FIXED", web3.toWei(2, "finney"), 5, {from: accounts[1]});
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
			return myExchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function(orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 sell offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 sell volume has one element");
			assert.equal(orderBook[1][0], 5, "OrderBook should have a volume of 5 coins someone wants to sell");
			return myExchangeInstance.buyToken("FIXED", web3.toWei(3, "finney"), 5);
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "BuyOrderFulfilled", "The Log-Event should be SellOrderFulfilled");
			return myExchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function(orderBook) {

			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 buy offers");
			assert.equal(orderBook[1].length, 0, "OrderBook should have 0 buy volume has one element");
			return myExchangeInstance.getBuyOrderBook.call("FIXED");
		}).then(function(orderBook) {

			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 sell offers");
			assert.equal(orderBook[1].length, 0, "OrderBook should have 0 sell volume elements");

		});
	});

	it("should be able to sell out a offer and create a buy limit order", function() {

		let myExchangeInstance;
		let account0initialTokenBalance;
		let account1initialTokenBalance;

		return exchange.deployed().then(function (instance) {
			myExchangeInstance = instance;
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function (balance) {
			account0initialTokenBalance = balance.toNumber();
			return myExchangeInstance.getBalance('FIXED', {from: accounts[1]});
		}).then(function (balance) {
			account1initialTokenBalance = balance.toNumber();
			return myExchangeInstance.sellToken("FIXED", web3.toWei(5, "finney"), 20, {from: accounts[1]});
		}).then(function (txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
			return myExchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 sell offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 sell volume has one element");
			assert.equal(orderBook[1][0].toNumber(), 20, "OrderBook should have a volume of 20 coins someone wants to sell");
			return myExchangeInstance.buyToken("FIXED", web3.toWei(8, "finney"), 35);
		}).then(function (txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one log messages emitted.");
			assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "Should have emitted a LimitBuyOrderCreated event as well.");
			return myExchangeInstance.getSellOrderBook("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 sell offers");
			assert.equal(orderBook[1].length, 0, "OrderBook should have 0 sell volume has one element");
			return myExchangeInstance.getBuyOrderBook("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 buy offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 buy volume elements");
			assert.equal(orderBook[1][0], 15, "There should be a buy order with 15 tokens");
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function (account0AfterBalance) {
			assert.equal(account0AfterBalance.toNumber() - account0initialTokenBalance, 20, "Account 0 should be 20 tokens richer");
			return myExchangeInstance.getBalance('FIXED', {from: accounts[1]});
		}).then(function (account1AfterBalance) {
			assert.equal(account1initialTokenBalance - account1AfterBalance.toNumber(), 20, "Account 1 should be 20 tokens poorer");
		});
	});

	it("Should be able to buy out some of an order", function() {

		let myExchangeInstance;
		let account0initialTokenBalance;

		// We don't test for account 1 here because it will lose 20 tokens to escrow when it lists the sell

		return exchange.deployed().then(function(instance) {
			myExchangeInstance = instance;
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function (balance) {
			account0initialTokenBalance = balance.toNumber();
			return myExchangeInstance.sellToken("FIXED", web3.toWei(20, "finney"), 20, {from: accounts[1]});
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");
			return myExchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function(orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 sell offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 sell volume has one element");
			assert.equal(orderBook[1][0], 20, "OrderBook should have a volume of 20 coins someone wants to sell");
			return myExchangeInstance.buyToken("FIXED", web3.toWei(20, "finney"), 5);
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one log messages emitted.");
			assert.equal(txResult.logs[0].event, "BuyOrderFulfilled", "Should have emitted a BuyOrderFulfilled event as well.");
			return myExchangeInstance.getSellOrderBook("FIXED");
		}).then(function(orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 sell offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 sell volume has one element");
			assert.equal(orderBook[1][0], 15, "This sale offer should still have 15 tokens available");
			return myExchangeInstance.getBuyOrderBook("FIXED");
		}).then(function(orderBook) {

			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 buy offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 buy volume elements");
			assert.equal(orderBook[1][0], 15, "There should be a buy order with 15 tokens");
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function (account0AfterBalance) {
			assert.equal(account0AfterBalance - account0initialTokenBalance, 5, "Account 0 should be 5 tokens richer");
		})
	})


});