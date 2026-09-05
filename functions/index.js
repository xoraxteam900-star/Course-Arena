const triggers = require("./triggers");
const purchase = require("./purchase");
const paystack = require("./paystack");
const courseApproval = require("./courseApproval");
const loginMarket = require("./loginMarket");

module.exports = {
  ...triggers,
  ...purchase,
  ...paystack,
  ...courseApproval,
  ...loginMarket,
};
