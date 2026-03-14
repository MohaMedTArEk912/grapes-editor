import { randomUUID } from 'crypto';
import prisma from './src/lib/prisma.js';
async function test() {
  try {
    const project = await prisma.project.create({
      data: { name: 'Direct Logic Test', description: '', settings: '{}' }
    });
    console.log('Project created:', project);
    const homePage = await prisma.page.create({
      data: {
          id: randomUUID(),
          projectId: project.id,
          name: 'Home',
          path: '/',
          isDynamic: false
      }
    });
    console.log('Page created:', homePage);
  } catch (e) {
    console.error('ERROR!!', e);
  }
}
test();
