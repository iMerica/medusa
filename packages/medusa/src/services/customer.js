import mongoose from "mongoose"
import bcrypt from "bcrypt"
import _ from "lodash"
import { Validator, MedusaError } from "medusa-core-utils"
import { BaseService } from "medusa-interfaces"

/**
 * Provides layer to manipulate customers.
 * @implements BaseService
 */
class CustomerService extends BaseService {
  constructor({ customerModel, eventBusService }) {
    super()

    /** @private @const {CustomerModel} */
    this.customerModel_ = customerModel

    /** @private @const {EventBus} */
    this.eventBus_ = eventBusService
  }

  /**
   * Used to validate customer ids. Throws an error if the cast fails
   * @param {string} rawId - the raw customer id to validate.
   * @return {string} the validated id
   */
  validateId_(rawId) {
    const schema = Validator.objectId()
    const { value, error } = schema.validate(rawId)
    if (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "The customerId could not be casted to an ObjectId"
      )
    }

    return value
  }

  /**
   * Used to validate customer email.
   * @param {string} email - email to validate
   * @return {string} the validated email
   */
  validateEmail_(email) {
    const schema = Validator.string()
      .email()
      .required()
    const { value, error } = schema.validate(email)
    if (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The email is not valid"
      )
    }

    return value
  }

  validateBillingAddress_(address) {
    const { value, error } = Validator.address().validate(address)
    if (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The address is not valid"
      )
    }

    return value
  }

  /**
   * Generate a JSON Web token, that will be sent to a customer, that wishes to
   * reset password.
   * The token will be signed with the customer's current password hash as a
   * secret a long side a payload with userId and the expiry time for the token,
   * which is always 15 minutes.
   * @param {string} customerId - the customer to reset the password for
   * @returns {string} the generated JSON web token
   */
  async generateResetPasswordToken(customerId) {
    const customer = await this.retrieve(customerId)

    if (!customer.has_account) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "You must have an account to reset the password. Create an account first"
      )
    }

    const secret = customer.password_hash
    const expiry = Math.floor(Date.now() / 1000) + 60 * 15 // 15 minutes ahead
    const payload = { customer_id: customer._id, exp: expiry }
    const token = jwt.sign(payload, secret)

    // TODO: Call event layer to ensure that there is an email service that
    // sends the token.

    return token
  }

  /**
   * @param {Object} selector - the query object for find
   * @return {Promise} the result of the find operation
   */
  list(selector) {
    return this.customerModel_.find(selector)
  }

  /**
   * Gets a customer by id.
   * @param {string} customerId - the id of the customer to get.
   * @return {Promise<Customer>} the customer document.
   */
  async retrieve(customerId) {
    const validatedId = this.validateId_(customerId)
    const customer = await this.customerModel_
      .findOne({ _id: validatedId })
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })

    if (!customer) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Customer with ${customerId} was not found`
      )
    }
    return customer
  }

  /**
   * Gets a customer by email.
   * @param {string} email - the email of the customer to get.
   * @return {Promise<Customer>} the customer document.
   */
  async retrieveByEmail(email) {
    this.validateEmail_(email)
    const customer = await this.customerModel_.findOne({ email }).catch(err => {
      throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
    })

    if (!customer) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Customer with email ${email} was not found`
      )
    }

    return customer
  }

  /**
   * Creates a customer from an email - customers can have accounts associated,
   * e.g. to login and view order history, etc. If a password is provided the
   * customer will automatically get an account, otherwise the customer is just
   * used to hold details of customers.
   * @param {object} customer - the customer to create
   * @return {Promise} the result of create
   */
  async create(customer) {
    const { email, billing_address, password } = customer
    this.validateEmail_(email)

    if (billing_address) {
      this.validateBillingAddress_(billing_address)
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      customer.password_hash = hashedPassword
      customer.has_account = true
      delete customer.password
    }

    return this.customerModel_.create(customer).catch(err => {
      throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
    })
  }

  /**
   * Updates a customer. Metadata updates and address updates should
   * use dedicated methods, e.g. `setMetadata`, etc. The function
   * will throw errors if metadata updates and address updates are attempted.
   * @param {string} variantId - the id of the variant. Must be a string that
   *   can be casted to an ObjectId
   * @param {object} update - an object with the update values.
   * @return {Promise} resolves to the update result.
   */
  async update(customerId, update) {
    const customer = await this.retrieve(customerId)

    if (update.metadata) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Use setMetadata to update metadata fields"
      )
    }

    if (update.email) {
      this.validateEmail_(update.email)
    }

    if (update.billing_address) {
      this.validateBillingAddress_(update.billing_address)
    }

    if (update.password) {
      const hashedPassword = await bcrypt.hash(update.password, 10)
      update.password_hash = hashedPassword
      update.has_account = true
      delete update.password
    }

    return this.customerModel_
      .updateOne(
        { _id: customer._id },
        { $set: update },
        { runValidators: true }
      )
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }

  /**
   * Deletes a customer from a given customer id.
   * @param {string} customerId - the id of the customer to delete. Must be
   *   castable as an ObjectId
   * @return {Promise} the result of the delete operation.
   */
  async delete(customerId) {
    let customer
    try {
      customer = await this.retrieve(customerId)
    } catch (error) {
      // Delete is idempotent, but we return a promise to allow then-chaining
      return Promise.resolve()
    }

    return this.customerModel_.deleteOne({ _id: customer._id }).catch(err => {
      throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
    })
  }

  /**
   * Decorates a customer.
   * @param {Customer} customer - the cart to decorate.
   * @param {string[]} fields - the fields to include.
   * @param {string[]} expandFields - fields to expand.
   * @return {Customer} return the decorated customer.
   */
  async decorate(customer, fields, expandFields = []) {
    const requiredFields = ["_id", "metadata"]
    const decorated = _.pick(customer, fields.concat(requiredFields))
    return decorated
  }

  /**
   * Dedicated method to set metadata for a customer.
   * To ensure that plugins does not overwrite each
   * others metadata fields, setMetadata is provided.
   * @param {string} customerId - the customer to apply metadata to.
   * @param {string} key - key for metadata field
   * @param {string} value - value for metadata field.
   * @return {Promise} resolves to the updated result.
   */
  setMetadata(customerId, key, value) {
    const validatedId = this.validateId_(customerId)

    if (typeof key !== "string") {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Key type is invalid. Metadata keys must be strings"
      )
    }

    const keyPath = `metadata.${key}`
    return this.customerModel_
      .updateOne({ _id: validatedId }, { $set: { [keyPath]: value } })
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }
}

export default CustomerService