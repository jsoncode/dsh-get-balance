async page => {
  await page.route('**/dsh-balance/api', async route => {
    await new Promise(r => setTimeout(r, 2000));
    await route.continue();
  });
}
