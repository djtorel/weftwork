// The sha256 of every text that setup has written into a project for each
// skill file, by its path under .claude/skills/. `weftwork update` replaces a
// file that holds one of these, since the owner did not change it, and keeps
// any other (update.ts, docs/SETUP.md § Update).
//
// The first entries come from git: every commit on main from a68ede1, when the
// skills began to call the `weftwork` command, to 5dd3fc0, each file turned
// into a project's text as setup.ts does (the transform was the same at each).
// From then on, update.test.ts fails when a skill text setup writes is not
// here, and names the hash to add. Never remove a hash: a project may still
// hold that text.
export const shippedSkillTexts: Readonly<Record<string, readonly string[]>> = {
  'full-stop/SKILL.md': [
    '95352a4b07338a02e6ace682469ee394eecac80a7e037e452de394873f4dbfb6',
    '4c3427007daa399d7e614756f089cee0bd7690ac749e5d1dce8368c567c30fda',
    'e8e6f2213b4de4f353d78b8cd48c4193b9013569d91726d84ee1759685dadbca',
  ],
  'review-loop/SKILL.md': [
    'f4518cbb0be0965fd21564a3cf2b38afce36504da7d11468fdd44dd30e8d6445',
    'dce4421dcc1dfbb16bd78ebf5b1459dc28c6826c289ba317ef8c54ae52170d60',
    'fcdd8092bac636969b395a4b2df81e0ea4be4bc029e383d23a31bdbcdc6b82fa',
  ],
  'file-pr/SKILL.md': [
    '259ad869d4a338806c88f50758c9dfccc0a261ced0648343d251856c1764cf74',
    '7d2047647715b36449ca46bf1ba3d017b3489938c4b6b659d6f3a3c9d95e38b8',
  ],
  'README.md': [
    '5d2cb5fc39f0c6c1e3b073c3e895c4a4c26cfcc1335c8a3db021aa71c5eb39cb',
    '50965023c6f86766e4a7e0b9efd7a0fa11da8598584b278e3e76e9de521e1e83',
    '83725397f1641b28a86d4129700841abcb4d96ded013922cc0d289a46fc6bfea',
    '22f99bfcd3cb4afffc3a895bf2bf5674b78d5c6a1ecd0457b4e071c88cbd7077', // PR #126
    '23cf353199033b2bbd50e912adabaecf752b2de03eb3e3f0066bb1d89623b4ba',
    '7950388ab1ad9992a930ab3741dbb817158cced4c23ff88b296739c5120443af',
  ],
  'TSTACK-LICENSE': [
    '8095f9a9f97d074131f6a2ce09b952d12c18b36f09f4e5df0517c4e64e82c851',
  ],
  'weft-ready/SKILL.md': [
    'b2907d0aac364a8caca386d642c34c5deb5e586f4075f2f6282f9a12686cbcaa',
  ],
  'weft-review/SKILL.md': [
    'eca82e6cbef3c7e392b3c0ba694449889a892c6684c657768c6f361a8e37a660',
  ],
  'weft-pr/SKILL.md': [
    '031fa965eedd41547986119c706e45a8da266ab18f00785ccb18a8acccbc6a00',
    'fbd1f1987338e43b147ee9f72a73d88848a8e584b62cd1e4b5d57b64a2836797',
  ],
  'weft-improve/SKILL.md': [
    '709cdadc2734b11ccbb8c68a12b102f48cef310a60f515de14354941d2251118',
  ],
  'all-ready/SKILL.md': [
    '3fe0398ad9929b1d5031aaa08d05146e4573086b39fcd9c2a4deda06babadacf',
    'a743086f6b9df98a9f6337f69150486cc71ebad7eb52ac420ac2ebea50fe0ab1',
    'fa11a3bff3a3f6479085253260f68ebb76780219338dfdaca709dfef26a39a06',
    'a2e493e06353e5a71e2b0c33c15cbc8f26559115156212406af852ed8d6f8031',
    '80cb1aa1e3afcfea48fcf1f0e7348e55eefc0183e1c0fc1817d990ff5360e020',
  ],
  'all-in/SKILL.md': [
    'c2db72138ef0f4c9b484e56783752abd5295d01230ac02e42143c4ad389173ee',
    '6f1d587cc9202ae8687a047464f85723e8446e4f28f5c5740c9f3aede907ebc8',
  ],
  'second-opinion/SKILL.md': [
    'f6318ad028b3e7fe4319bff9bd01ad272a9cd2ff5fecdef0633d51fa74de95c7',
    '83f0fa22b038f07d490e331afb53597a799c9853f235a6352eaad1f9c9b0d513',
    '52ba6310d7f1b0268bd7f667164bb8fdd718c3005c60a037ba5e9336529a2269',
  ],
  'pr-it/SKILL.md': [
    'c000cda6a77ec0df063c2923f7dfb76039e233fd1674cd62e6b24c18a586b9c3',
  ],
  'retro/SKILL.md': [
    'bda6aafadbd67f20f8561823c4128e21c46cac570bd90d1839492cb77b23de8b',
  ],
};
