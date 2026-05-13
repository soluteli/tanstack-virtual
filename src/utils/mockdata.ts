import { faker } from '@faker-js/faker'

export const randomNumber = (min: number, max: number) =>
  faker.number.int({ min, max })

export const sentences = new Array(1000)
  .fill(true)
  .map(() => faker.lorem.sentence(randomNumber(20, 70)))

export interface MessageWithImage {
  uid: string
  id: number
  text: string
  imageUrl: string
}

export const messagesWithImage: MessageWithImage[] = new Array(1000)
  .fill(true)
  .map((_, i) => ({
    uid: faker.string.uuid(),
    id: i,
    text: faker.lorem.sentence(randomNumber(20, 70)),
    imageUrl: faker.image.urlPicsumPhotos({ width: 40, height: randomNumber(10, 100) }),
  }))
