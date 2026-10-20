/**
 * The shared database (Supabase).
 *
 * WHERE THEY COME FROM: supabase.com -> project `el-anotador` (shared with El Anotador and
 * Súper, which keeps it awake) -> Project Settings -> API Keys. This is the **publishable**
 * key (what older docs call "anon public").
 *
 * ON KEEPING A KEY IN A PUBLIC REPO: the publishable key ships inside the page by design. It
 * grants only what the database allows the anonymous role, and for this app that is nothing on
 * the tables themselves: every read and write goes through functions that require the garden
 * key (see supabase/schema.sql). Never put the **secret** key here.
 */
export const SUPABASE_URL = 'https://omnsrtybcunqfmevjgip.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_kJguKfrNO_4b8bC6tZSqDg_KA9Ev6I0'

/**
 * Where the site is published. The NFC tags hold links under this address, so it must not
 * change once tags are written: a subdomain of Mario's own domain, pointed at GitHub Pages.
 */
export const SITE_URL = 'https://plantas.marioconti.com.ar/'
