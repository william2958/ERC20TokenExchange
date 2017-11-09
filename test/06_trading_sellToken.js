let fixedSupplyToken = artifacts.require('./FixedSupplyToken.sol');
let exchange = artifacts.require('./Exchange.sol');

contract('Sell Token Tests', function (accounts) {

	before(function() {
		let instanceExchange;
		let instanceToken;
		return exchange.deployed().then(function(instance) {
			instanceExchange = instance;
			return instanceExchange.depositEther({from: accounts[0], value: web3.toWei(4, "ether")});
		}).then(function(txResult) {
			return instanceExchange.depositEther({from: accounts[1], value: web3.toWei(3, "ether")});
		}).then(function(txResult) {
			return fixedSupplyToken.deployed();
		}).then(function(myTokenInstance){
			instanceToken = myTokenInstance;
			return instanceExchange.addToken("FIXED", instanceToken.address);
		}).then(function(txResult) {
			return instanceToken.transfer(accounts[1], 2000);
		}).then(function(txResult) {
			return instanceToken.approve(instanceExchange.address, 2000, {from: accounts[1]});
		}).then(function(txResult) {
			return instanceExchange.depositToken('FIXED', 2000, {from: accounts[1]});
		}).then(function(txResult) {
			return instanceToken.approve(instanceExchange.address, 2000, {from: accounts[0]});
		}).then(function(txResult) {
			return instanceExchange.depositToken('FIXED', 2000, {from: accounts[0]});
		})
	});

	it("should be possible to fully sell a token to a buyer", function() {

		let myExchangeInstance;
		let initialAccount0TokenBalance;
		let initialAccount1TokenBalance;
		let balanceBeforeSaleAccount0;
		let balanceBeforeSaleAccount1;
		let balanceAfterSaleAccount0;
		let balanceAfterSaleAccount1;
		let amount = 10;

		return exchange.deployed().then(function(instance) {
			myExchangeInstance = instance;
			return myExchangeInstance.getBuyOrderBook.call('FIXED');
		}).then(function(orderBook) {
			assert.equal(orderBook.length, 2, "getBuyOrderBook should have 2 elements");
			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 buy offers");
			return myExchangeInstance.getEthBalanceInWei({from: accounts[0]});
		}).then(function(balance) {
			balanceBeforeSaleAccount0 = balance.toNumber();
			return myExchangeInstance.getEthBalanceInWei({from: accounts[1]});
		}).then(function(balance) {
			balanceBeforeSaleAccount1 = balance.toNumber();
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function(balance) {
			initialAccount0TokenBalance = balance.toNumber();
			return myExchangeInstance.getBalance('FIXED', {from: accounts[1]});
		}).then(function(balance) {
			initialAccount1TokenBalance = balance.toNumber();
			return myExchangeInstance.buyToken('FIXED', web3.toWei(3, "finney"), amount, {from: accounts[1]});
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one event emitted.");
			assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "There should have been a LimitBuyOrderCreated");
			return myExchangeInstance.getBuyOrderBook.call('FIXED');
		}).then(function(orderBook) {
			assert.equal(orderBook.length, 2, "getBuyOrderBook should have 2 elements");
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 buy offer");
			assert.equal(orderBook[1][0], 10, "Limit Buy order should be selling 10 tokens.");
			return myExchangeInstance.sellToken('FIXED', web3.toWei(2, "finney"), amount, {from: accounts[0]});
		}).then(function(txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Event emitted.");
			assert.equal(txResult.logs[0].event, "SellOrderFulfilled", "The Log-Event should be SellOrderFulfilled");
			return myExchangeInstance.getBuyOrderBook.call('FIXED');
		}).then(function(orderBook) {
			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 buy offers");
			assert.equal(orderBook[1].length, 0, "OrderBook should have 0 buy volume has one element");
			return myExchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function(orderBook) {
			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 buy offers");
			assert.equal(orderBook[1].length, 0, "OrderBook should have 0 buy volume has one element");

			// Check ether balances
			return myExchangeInstance.getEthBalanceInWei({from: accounts[0]});
		}).then(function(balance) {
			balanceAfterSaleAccount0 = balance.toNumber();
			return myExchangeInstance.getEthBalanceInWei({from: accounts[1]});
		}).then(function(balance) {
			balanceAfterSaleAccount1 = balance.toNumber();

			assert.equal(balanceAfterSaleAccount0 - balanceBeforeSaleAccount0, web3.toWei(3, 'finney') * amount, "Difference in account balance 0 should be 3 finney");
			assert.equal(balanceBeforeSaleAccount1 - balanceAfterSaleAccount1, web3.toWei(3, 'finney') * amount, "Difference in account balance 1 should be 3 finney");
		});
	});

	it('Should be able to buy out an order and create a sell limit order', function() {

		let myExchangeInstance;
		let account0initialTokenBalance;
		let account1initialTokenBalance;

		return exchange.deployed().then(function (instance) {
			myExchangeInstance = instance;
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function (balance) {
			account0initialTokenBalance = balance.toNumber();
			return myExchangeInstance.getBalance('FIXED', {from: accounts[1]});
		}).then(function(balance) {
			account1initialTokenBalance = balance.toNumber();
			return myExchangeInstance.buyToken('FIXED', web3.toWei(8, "finney"), 20, {from: accounts[1]});
		}).then(function (txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "The Log-Event should be LimitBuyOrderCreated");
			return myExchangeInstance.getBuyOrderBook.call("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 buy offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 buy volume has one element");
			assert.equal(orderBook[1][0].toNumber(), 20, "OrderBook should have a volume of 20 coins someone wants to buy");
			return myExchangeInstance.sellToken("FIXED", web3.toWei(5, "finney"), 35, {from: accounts[0]});
		}).then(function (txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one log messages emitted.");
			assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "Should have emitted a LimitSellOrderCreated event as well.");
			return myExchangeInstance.getBuyOrderBook("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 buy offers");
			assert.equal(orderBook[1].length, 0, "OrderBook should have 0 buy volume has one element");
			return myExchangeInstance.getSellOrderBook("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 sell offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 sell volume elements");
			assert.equal(orderBook[1][0], 15, "There should be a sell order with 15 tokens");
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function (account0AfterBalance) {
			assert.equal(account0initialTokenBalance - account0AfterBalance.toNumber(), 35, "Account 0 should be 35 tokens poorer");
			return myExchangeInstance.getBalance('FIXED', {from: accounts[1]});
		}).then(function (account1AfterBalance) {
			assert.equal(account1AfterBalance.toNumber() - account1initialTokenBalance, 20, "Account 1 should be 20 tokens richer");
		});

	});

	it("should be able to sell out some of a buy order", function() {

		let myExchangeInstance;
		let account0initialTokenBalance;
		let account1initialTokenBalance;

		return exchange.deployed().then(function (instance) {
			myExchangeInstance = instance;
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function (balance) {
			account0initialTokenBalance = balance.toNumber();
			return myExchangeInstance.getBalance('FIXED', {from: accounts[1]});
		}).then(function(balance) {
			account1initialTokenBalance = balance.toNumber();
			return myExchangeInstance.buyToken('FIXED', web3.toWei(20, "gwei"), 20, {from: accounts[1]});
		}).then(function (txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "The Log-Event should be LimitBuyOrderCreated");
			return myExchangeInstance.getBuyOrderBook.call("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 buy offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 buy volume has one element");
			assert.equal(orderBook[1][0].toNumber(), 20, "OrderBook should have a volume of 20 coins someone wants to buy");
			return myExchangeInstance.sellToken("FIXED", web3.toWei(20, "gwei"), 5, {from: accounts[0]});
		}).then(function (txResult) {
			assert.equal(txResult.logs.length, 1, "There should have been one log messages emitted.");
			assert.equal(txResult.logs[0].event, "SellOrderFulfilled", "Should have emitted a SellOrderFulfilled event as well.");
			return myExchangeInstance.getBuyOrderBook("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 buy offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 buy volume has one element");
			assert.equal(orderBook[1][0], 15, "This buy offer should still have 15 tokens available");
			return myExchangeInstance.getSellOrderBook("FIXED");
		}).then(function (orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook should have 1 sell offers");
			assert.equal(orderBook[1].length, 1, "OrderBook should have 1 sell volume elements");
			assert.equal(orderBook[1][0], 15, "There should be a sell order with 15 tokens");
			return myExchangeInstance.getBalance('FIXED', {from: accounts[0]});
		}).then(function (account0AfterBalance) {
			assert.equal(account0initialTokenBalance - account0AfterBalance.toNumber(), 5, "Account 0 should be 5 tokens poorer");
		})

	})

});