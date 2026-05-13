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

interface GenMessagesListHistoryParams {
  size: number
  start?: number
  end?: number
}

export const genMessagesListHistory = ({
  size,
  start,
  end,
}: GenMessagesListHistoryParams): MessageWithImage[] => {
  if (start !== undefined && end !== undefined) {
    throw new Error('Cannot specify both start and end')
  }

  const count = start !== undefined 
    ? size 
    : end !== undefined 
      ? (end - size) >=0 ? size : end
      : size

  const startIndex = start ?? (end !== undefined ? end - size : 0)

  return new Array(count)
    .fill(true)
    .map((_, i) => ({
      uid: faker.string.uuid(),
      id: startIndex + i,
      text: faker.lorem.sentence(randomNumber(20, 70)),
      imageUrl: faker.image.urlPicsumPhotos({ width: 40, height: randomNumber(10, 100) }),
    }))
}