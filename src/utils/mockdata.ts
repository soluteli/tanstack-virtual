import { faker } from '@faker-js/faker'

export const randomNumber = (min: number, max: number) =>
  faker.number.int({ min, max })

export const sentences = new Array(1000)
  .fill(true)
  .map(() => faker.lorem.sentence(randomNumber(20, 70)))
