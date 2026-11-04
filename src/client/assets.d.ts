/** esbuild inlines PNG assets as data URLs (see the \`loader\` in build.mjs). */
declare module "*.png" {
  const url: string;
  export default url;
}
