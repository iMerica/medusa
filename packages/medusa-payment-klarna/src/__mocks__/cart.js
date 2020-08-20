import { IdMap } from "medusa-test-utils"

export const carts = {
  frCart: {
    _id: IdMap.getId("fr-cart"),
    email: "lebron@james.com",
    title: "test",
    region_id: IdMap.getId("region-france"),
    items: [
      {
        _id: IdMap.getId("line"),
        title: "merge line",
        description: "This is a new line",
        thumbnail: "test-img-yeah.com/thumb",
        content: [
          {
            unit_price: 8,
            variant: {
              _id: IdMap.getId("eur-8-us-10"),
            },
            product: {
              _id: IdMap.getId("product"),
            },
            quantity: 1,
          },
          {
            unit_price: 10,
            variant: {
              _id: IdMap.getId("eur-10-us-12"),
            },
            product: {
              _id: IdMap.getId("product"),
            },
            quantity: 1,
          },
        ],
        quantity: 10,
      },
      {
        _id: IdMap.getId("existingLine"),
        title: "merge line",
        description: "This is a new line",
        thumbnail: "test-img-yeah.com/thumb",
        content: {
          unit_price: 10,
          variant: {
            _id: IdMap.getId("eur-10-us-12"),
          },
          product: {
            _id: IdMap.getId("product"),
          },
          quantity: 1,
        },
        quantity: 10,
      },
    ],
    shipping_methods: [
      {
        _id: IdMap.getId("freeShipping"),
        profile_id: "default_profile",
      },
    ],
    shipping_options: [
      {
        _id: IdMap.getId("freeShipping"),
        profile_id: "default_profile",
      },
    ],
    payment_sessions: [
      {
        provider_id: "stripe",
        data: {
          id: "pi_123456789",
          customer: IdMap.getId("not-lebron"),
        },
      },
    ],
    payment_method: {
      provider_id: "stripe",
      data: {
        id: "pi_123456789",
        customer: IdMap.getId("not-lebron"),
      },
    },
    shipping_address: {},
    billing_address: {},
    discounts: [
      {
        code: "MEDUSA_FREE",
        discount_rule: {
          type: "percent",
          value: 20,
          allocation: "item",
        },
      },
    ],
    customer_id: IdMap.getId("lebron"),
  },
}

export const CartServiceMock = {
  retrieve: jest.fn().mockImplementation((cartId) => {
    if (cartId === IdMap.getId("fr-cart")) {
      return Promise.resolve(carts.frCart)
    }
    return Promise.resolve(undefined)
  }),
  updatePaymentSession: jest
    .fn()
    .mockImplementation((cartId, stripe, paymentIntent) => {
      return Promise.resolve()
    }),
}

const mock = jest.fn().mockImplementation(() => {
  return CartServiceMock
})

export default mock