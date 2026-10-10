# Publish the ARCE website update

The default package targets `https://www.albany.edu/arce/dev/`, with FAB 0.5.0
under `/arce/dev/app/`. Its Back to ARCE link returns to `/arce/dev/` in the same
tab, including on phones. The website revision is October 6, 2026. Packaging
does not publish it. `UPLOAD-MANIFEST.json` records the exact target and paths.

For a later production review, use `bun run build:arce production`,
`bun run check:arce production` and `ARCE_TARGET=production bun run test:arce`.
That separate package targets `/arce/` and returns there from `/arce/app/`.
Do not copy the dev package into the production folder. Biography links continue
to use the retained canonical pages under `/arce/` in both environments.

## Access and backup

Verify the university publishing account, host, secure transfer protocol and
remote ARCE folder before transferring files. GlobalProtect provides campus
network access; it does not establish which publishing server or folder to use.
Use the existing ARCE access. With the verified OpenSSH client, use
`-B 16384 -R 1` for transfers: concurrent requests produced server write/close
errors on the burial index, while a single-request upload succeeded. Do not
assume a personal `public_html` folder is the departmental website. Do not send credentials or disable certificate checks.

Download every existing destination in `UPLOAD-MANIFEST.json` before replacing
it. Store that backup outside the public website, with file hashes. The task's
`live-backup/` contains public-page copies, not a complete publishing-server backup.
Confirm whether root `index.html` is the server's selected directory index.

## Upload and verify

For dev, the local website folder is `upload/arce/dev/` and the verified remote
folder is `/wwwres/arce/dev`. For production, they are `upload/arce/` and
`/wwwres/arce`. The steps below use paths relative to that selected folder.
Jackson approved replacing the disposable dev contents on October 6, 2026;
production replacement remains on hold.

1. Upload `app/assets/`, `app/data/` and the other static app files into the
   selected folder. In production, keep old hashed assets for cached clients.
2. Publish `app/index.html`, `app/manifest.json` and `app/service-worker.js` after
   their dependencies. Test the manifested app URL, burial search for Thomas LaMont,
   location filters, a tour, directions and a shared record link.
3. Upload the revised root pages, guide images, `arce-launch.css` and `arce-guide.js`.
4. Publish `tours.html` and `Burial_Locator/index.html` last. These preserve the
   supported query parameters while forwarding visitors into the current app.
5. Verify manifest hashes against downloaded public responses. UAlbany's
   Cloudflare layer obfuscates email links on four HTML pages: decode only that
   transformation and require the resulting content to match the source hash.
   Use a web-compatible request header. The directory homepage has a five-minute cache header; verify that it
   refreshes after upload and also check the explicit `index.html`.
   Check a phone
   viewport, keyboard navigation, guide images, biography links, privacy and help.
   Confirm service-worker scope matches the manifested app URL. Dev and production
   use separate cache names; caches outside the selected environment must survive.

The reviewed package updates `biolist.html` and `graves.html` while retaining their source content.
Preserve `Grave_Finder/`, every existing biography, image collection and historical
data file. The revised website directs visitors only to the current app; the old
tool is retained on the server without a link from the website. The current
locator searches burial records by name, section, lot and tier. Never replace
the whole ARCE tree or enable remote-delete sync.

Serve app HTML, the manifest and service worker with revalidation if server
controls permit it. Hashed assets may use immutable caching. Verify actual HTTP
headers after publishing. FTP/SFTP access may not include header or redirect controls.

## Rollback

Restore the backed-up root pages and old entry files if the new app fails public
checks. Restore matching app HTML, manifest and worker together if reverting an
existing app release. Leave older hashed assets available. Do not clear other apps'
origin-wide caches or delete unrelated files.

## Future updates

Keep app code, site page source, guide images and this procedure in the same
review. Run `bun run check`, `bun run build:arce`, `bun run check:arce` and
`bun run test:arce`. Save the manifest, ZIP, SHA-256 and test report for each upload.
Refresh guide images when the controls change.

The current app does not offer a complete offline cemetery download. Do not
publish the earlier unmerged offline release as if it were FAB 0.5.0. An installed
iOS app update and physical-device acceptance are separate from this website upload.
