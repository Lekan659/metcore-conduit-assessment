const router = require("express").Router();
const verifyToken = require("../middleware/authentication");
const { UnauthorizedError, NotFoundError, ValidationError } = require("../helper/customErrors");
const {
  createCollection,
  getCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  addArticleToCollection,
  removeArticleFromCollection,
} = require("../controllers/collections");

// Apply the existing authentication middleware to every collection endpoint.
router.use(async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  try {
    await new Promise((resolve, reject) => {
      verifyToken(req, res, (error) => error ? reject(error) : resolve());
    });
    if (!req.loggedUser) throw new UnauthorizedError();
    next();
  } catch (error) {
    const tokenError = ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name);
    if (tokenError || error instanceof SyntaxError || error instanceof NotFoundError) {
      return next(new UnauthorizedError());
    }
    next(error);
  }
});

router.param("id", (req, res, next, id) => {
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 || Number(id) > 2147483647) {
    return next(new ValidationError("Collection ID must be a positive integer"));
  }
  next();
});

router.get("/", getCollections);
router.post("/", createCollection);
router.get("/:id", getCollection);
router.put("/:id", updateCollection);
router.delete("/:id", deleteCollection);
router.post("/:id/articles", addArticleToCollection);
router.delete("/:id/articles/:slug", removeArticleFromCollection);

module.exports = router;
