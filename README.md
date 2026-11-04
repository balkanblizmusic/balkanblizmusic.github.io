# BLiZ TV website

Public static website for bliztv.online, published with GitHub Pages. Android source code is kept in the separate private BLiZ-TV repository.

The signed Android 1.2.32 APK and Windows installer are attached to the v1.2.32 release. The website links to these release assets.

The pairing, reseller and checkout services continue to use their existing Supabase backends. New M3U credential dialogs use the Supabase playlist endpoint directly because GitHub Pages cannot execute the old Netlify /get.php proxy.

Existing issued /get.php playlist links require a compatible proxy before changing the custom-domain DNS. Do not remove the old hosting until that compatibility requirement is resolved.
