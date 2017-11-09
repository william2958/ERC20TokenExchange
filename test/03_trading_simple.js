let fixedSupplyToken = artifacts.require("./FixedSupplyToken.sol");
let exchange = artifacts.require('./Exchange.sol');

contract('Simple Order Tests', function(accounts) {

	before(function() {
		let instanceExchange;
		let instanceToken;
		return exchange.deployed().then(function(instance) {
			instanceExchange = instance;
			return instanceExchange.depositEther({from: accounts[0], value: web3.toWei(3, "ether")});
		}).then(function(txResult) {
			return fixedSupplyToken.deployed();
		}).then(function(myTokenInstance) {
			instanceToken = myTokenInstance;
			return instanceExchange.addToken("FIXED", instanceToken.address);
		}).then(function(txResult) {
			return instanceToken.approve(instanceExchange.address, 2000);
		}).then(function(txResult) {
			return instanceExchange.depositToken('FIXED', 2000);
		});
	});

	it("Should be possible to add a limit buy order", function() {
		let myExchangeInstance;
		return exchange.deployed().then(function(instance) {
			myExchangeInstance = instance;
			return myExchangeInstance.getBuyOrderBook.call('FIXED');
		}).then(function(orderBook) {
			// Make sure our order book was instantiated properly
			assert.equal(orderBook.length, 2, "BuyOrderBook should have 2 elements");
			assert.equal(orderBook[0].length, 0, "OrderBook should have 0 buy offers");
			// Create a buy order for 5 FIXED tokens, at 1 finney each
			return myExchangeInstance.buyToken("FIXED", web3.toWei(1, "finney"), 5);
		}).then(function(txResult) {
			// Assert the logs
			assert.equal(txResult.logs.length, 1, "There should have been one log message emitted");
			assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "The Log-Event should be LimitBuyOrderCreated");
			return myExchangeInstance.getBuyOrderBook('FIXED');
		}).then(function(orderBook) {
			assert.equal(orderBook[0].length, 1, "OrderBook price array should have 1 element");
			assert.equal(orderBook[1].length, 1, "OrderBook volume array should have 1 element");
		});
	});

	it("should be possible to add three limit buy orders", function () {
		let myExchangeInstance;
		let orderBookLengthBeforeBuy;
		return exchange.deployed().then(function (exchangeInstance) {
			myExchangeInstance = exchangeInstance;
			return myExchangeInstance.getBuyOrderBook.call("FIXED");
		}).then(function (orderBook) {
			// This should be 1 because we just added one before this test
			orderBookLengthBeforeBuy = orderBook[0].length;
			// add an offer to the top of the available offers
			return myExchangeInstance.buyToken("FIXED", web3.toWei(2, "finney"), 5);
		}).then(function(txResult) {
			assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "The Log-Event should be LimitBuyOrderCreated");
			// Add an offer that needs to be inserted between two BuyOrders
			return myExchangeInstance.buyToken("FIXED", web3.toWei(1.4, "finney"), 5);
		}).then(function(txResult) {
			assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "The Log-Event should be LimitBuyOrderCreated");
			return myExchangeInstance.getBuyOrderBook.call("FIXED");
		}).then(function(orderBook) {
			// Make sure the length matches up
			assert.equal(orderBook[0].length, orderBookLengthBeforeBuy+2, "OrderBook should have one more buy offers");
			assert.equal(orderBook[1].length, orderBookLengthBeforeBuy+2, "OrderBook should have 2 buy volume elements");
		});
	});


	it("should be possible to add two limit sell orders", function () {
		let myExchangeInstance;
		return exchange.deployed().then(function (instance) {
			myExchangeInstance = instance;
			return myExchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function (orderBook) {
			// Add a sell order
			return myExchangeInstance.sellToken("FIXED", web3.toWei(3, "finney"), 5);
		}).then(function(txResult) {
			/**
			 * Assert the logs
			 */
			assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
			assert.equal(txResult.logs[0].event, "LimitSellOrderCreated", "The Log-Event should be LimitSellOrderCreated");

			// Add another sell order
			return myExchangeInstance.sellToken("FIXED", web3.toWei(6, "finney"), 5);
		}).then(function(txResult) {
			return myExchangeInstance.getSellOrderBook.call("FIXED");
		}).then(function(orderBook) {
			// Make sure the sell order book makes sense
			assert.equal(orderBook[0].length, 2, "OrderBook should have 2 sell offers");
			assert.equal(orderBook[1].length, 2, "OrderBook should have 2 sell volume elements");
		});
	});


	it("should be possible to create and cancel a buy order", function () {
	   let myExchangeInstance;
	   let orderBookLengthBeforeBuy, orderBookLengthAfterBuy, orderBookLengthAfterCancel, orderKey;
	   return exchange.deployed().then(function (instance) {
	       myExchangeInstance = instance;
	       return myExchangeInstance.getBuyOrderBook.call("FIXED");
	   }).then(function (orderBook) {
	       orderBookLengthBeforeBuy = orderBook[0].length;
	       // Add a buy offer
	       return myExchangeInstance.buyToken("FIXED", web3.toWei(2.2, "finney"), 5);
	   }).then(function(txResult) {
	       /**
	        * Assert the logs
	        */
	       assert.equal(txResult.logs.length, 1, "There should have been one Log Message emitted.");
	       assert.equal(txResult.logs[0].event, "LimitBuyOrderCreated", "The Log-Event should be LimitBuyOrderCreated");
	       orderKey = txResult.logs[0].args._orderKey;
	       return myExchangeInstance.getBuyOrderBook.call("FIXED");
	   }).then(function (orderBook) {
	       orderBookLengthAfterBuy = orderBook[0].length;
	       assert.equal(orderBookLengthAfterBuy, orderBookLengthBeforeBuy + 1, "OrderBook should have 1 buy offers more than before");
	       // Cancel the order
	       return myExchangeInstance.cancelOrder("FIXED", false, web3.toWei(2.2, "finney"), orderKey);
	   }).then(function(txResult) {
	       assert.equal(txResult.logs[0].event, "BuyOrderCancelled", "The Log-Event should be BuyOrderCancelled");
	       return myExchangeInstance.getBuyOrderBook.call("FIXED");
	   }).then(function(orderBook) {
	       orderBookLengthAfterCancel = orderBook[0].length;
	       // OrderBook should be the same number of offers as after the buy offer
	       assert.equal(orderBookLengthAfterCancel, orderBookLengthAfterBuy, "OrderBook should still have the buy offer listed");
	       // But the volume for that offer should be zero -1 because index is left shifted
	       assert.equal(orderBook[1][orderBookLengthAfterCancel-1].toNumber(), 0, "The available Volume should be zero");
	   });
	});

});