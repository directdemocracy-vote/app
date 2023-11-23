<?php

# Test vector for RSABSSA-SHA384-PSS-Randomized from https://datatracker.ietf.org/doc/html/rfc9474#appendix-A.1
$test_p           = 'e1f4d7a34802e27c7392a3cea32a262a34dc3691bd87f3f310dc75673488930559c120fd0410194fb8a0da55bd0b81227e843fdca6692ae80e5a5d414116d4803fca7d8c30eaaae57e44a1816ebb5c5b0606c536246c7f11985d731684150b63c9a3ad9e41b04c0b5b27cb188a692c84696b742a80d3cd00ab891f2457443dadfeba6d6daf108602be26d7071803c67105a5426838e6889d77e8474b29244cefaf418e381b312048b457d73419213063c60ee7b0d81820165864fef93523c9635c22210956e53a8d96322493ffc58d845368e2416e078e5bcb5d2fd68ae6acfa54f9627c42e84a9d3f2774017e32ebca06308a12ecc290c7cd1156dcccfb2311';
$test_q           = 'c601a9caea66dc3835827b539db9df6f6f5ae77244692780cd334a006ab353c806426b60718c05245650821d39445d3ab591ed10a7339f15d83fe13f6a3dfb20b9452c6a9b42eaa62a68c970df3cadb2139f804ad8223d56108dfde30ba7d367e9b0a7a80c4fdba2fd9dde6661fc73fc2947569d2029f2870fc02d8325acf28c9afa19ecf962daa7916e21afad09eb62fe9f1cf91b77dc879b7974b490d3ebd2e95426057f35d0a3c9f45f79ac727ab81a519a8b9285932d9b2e5ccd347e59f3f32ad9ca359115e7da008ab7406707bd0e8e185a5ed8758b5ba266e8828f8d863ae133846304a2936ad7bc7c9803879d2fc4a28e69291d73dbd799f8bc238385';
$test_n           = 'aec4d69addc70b990ea66a5e70603b6fee27aafebd08f2d94cbe1250c556e047a928d635c3f45ee9b66d1bc628a03bac9b7c3f416fe20dabea8f3d7b4bbf7f963be335d2328d67e6c13ee4a8f955e05a3283720d3e1f139c38e43e0338ad058a9495c53377fc35be64d208f89b4aa721bf7f7d3fef837be2a80e0f8adf0bcd1eec5bb040443a2b2792fdca522a7472aed74f31a1ebe1eebc1f408660a0543dfe2a850f106a617ec6685573702eaaa21a5640a5dcaf9b74e397fa3af18a2f1b7c03ba91a6336158de420d63188ee143866ee415735d155b7c2d854d795b7bc236cffd71542df34234221a0413e142d8c61355cc44d45bda94204974557ac2704cd8b593f035a5724b1adf442e78c542cd4414fce6f1298182fb6d8e53cef1adfd2e90e1e4deec52999bdc6c29144e8d52a125232c8c6d75c706ea3cc06841c7bda33568c63a6c03817f722b50fcf898237d788a4400869e44d90a3020923dc646388abcc914315215fcd1bae11b1c751fd52443aac8f601087d8d42737c18a3fa11ecd4131ecae017ae0a14acfc4ef85b83c19fed33cfd1cd629da2c4c09e222b398e18d822f77bb378dea3cb360b605e5aa58b20edc29d000a66bd177c682a17e7eb12a63ef7c2e4183e0d898f3d6bf567ba8ae84f84f1d23bf8b8e261c3729e2fa6d07b832e07cddd1d14f55325c6f924267957121902dc19b3b32948bdead5';
$test_e           = '010001';
$test_d           = '0d43242aefe1fb2c13fbc66e20b678c4336d20b1808c558b6e62ad16a287077180b177e1f01b12f9c6cd6c52630257ccef26a45135a990928773f3bd2fc01a313f1dac97a51cec71cb1fd7efc7adffdeb05f1fb04812c924ed7f4a8269925dad88bd7dcfbc4ef01020ebfc60cb3e04c54f981fdbd273e69a8a58b8ceb7c2d83fbcbd6f784d052201b88a9848186f2a45c0d2826870733e6fd9aa46983e0a6e82e35ca20a439c5ee7b502a9062e1066493bdadf8b49eb30d9558ed85abc7afb29b3c9bc644199654a4676681af4babcea4e6f71fe4565c9c1b85d9985b84ec1abf1a820a9bbebee0df1398aae2c85ab580a9f13e7743afd3108eb32100b870648fa6bc17e8abac4d3c99246b1f0ea9f7f93a5dd5458c56d9f3f81ff2216b3c3680a13591673c43194d8e6fc93fc1e37ce2986bd628ac48088bc723d8fbe293861ca7a9f4a73e9fa63b1b6d0074f5dea2a624c5249ff3ad811b6255b299d6bc5451ba7477f19c5a0db690c3e6476398b1483d10314afd38bbaf6e2fbdbcd62c3ca9797a420ca6034ec0a83360a3ee2adf4b9d4ba29731d131b099a38d6a23cc463db754603211260e99d19affc902c915d7854554aabf608e3ac52c19b8aa26ae042249b17b2d29669b5c859103ee53ef9bdc73ba3c6b537d5c34b6d8f034671d7f3a8a6966cc4543df223565343154140fd7391c7e7be03e241f4ecfeb877a051';
$test_blinded_msg = 'aa3ee045138d874669685ffaef962c7694a9450aa9b4fd6465db9b3b75a522bb921c4c0fdcdfae9667593255099cff51f5d3fd65e8ffb9d3b3036252a6b51b6edfb3f40382b2bbf34c0055e4cbcc422850e586d84f190cd449af11dc65545f5fe26fd89796eb87da4bda0c545f397cddfeeb56f06e28135ec74fd477949e7677f6f36cfae8fd5c1c5898b03b9c244cf6d1a4fb7ad1cb43aff5e80cb462fac541e72f67f0a50f1843d1759edfaae92d1a916d3f0efaf4d650db416c3bf8abdb5414a78cebc97de676723cb119e77aea489f2bbf530c440ebc5a75dccd3ebf5a412a5f346badd61bee588e5917bdcce9dc33c882e39826951b0b8276c6203971947072b726e935816056ff5cb11a71ca2946478584126bb877acdf87255f26e6cca4e0878801307485d3b7bb89b289551a8b65a7a6b93db010423d1406e149c87731910306e5e410b41d4da3234624e74f92845183e323cf7eb244f212a695f8856c675fbc3a021ce649e22c6f0d053a9d238841cf3afdc2739f99672a419ae13c17f1f8a3bc302ec2e7b98e8c353898b7150ad8877ec841ea6e4b288064c254fefd0d049c3ad196bf7ffa535e74585d0120ce728036ed500942fbd5e6332c298f1ffebe9ff60c1e117b274cf0cb9d70c36ee4891528996ec1ed0b178e9f3c0c0e6120885f39e8ccaadbb20f3196378c07b1ff22d10049d3039a7a92fe7efdd95d';
$test_blind_sig   = '3f4a79eacd4445fca628a310d41e12fcd813c4d43aa4ef2b81226953248d6d00adfee6b79cb88bfa1f99270369fd063c023e5ed546719b0b2d143dd1bca46b0e0e615fe5c63d95c5a6b873b8b50bc52487354e69c3dfbf416e7aca18d5842c89b676efdd38087008fa5a810161fcdec26f20ccf2f1e6ab0f9d2bb93e051cb9e86a9b28c5bb62fd5f5391379f887c0f706a08bcc3b9e7506aaf02485d688198f5e22eefdf837b2dd919320b17482c5cc54271b4ccb41d267629b3f844fd63750b01f5276c79e33718bb561a152acb2eb36d8be75bce05c9d1b94eb609106f38226fb2e0f5cd5c5c39c59dda166862de498b8d92f6bcb41af433d65a2ac23da87f39764cb64e79e74a8f4ce4dd567480d967cefac46b6e9c06434c3715635834357edd2ce6f105eea854ac126ccfa3de2aac5607565a4e5efaac5eed491c335f6fc97e6eb7e9cea3e12de38dfb315220c0a3f84536abb2fdd722813e083feda010391ac3d8fd1cd9212b5d94e634e69ebcc800c4d5c4c1091c64afc37acf563c7fc0a6e4c082bc55544f50a7971f3fb97d5853d72c3af34ffd5ce123998be5360d1059820c66a81e1ee6d9c1803b5b62af6bc877526df255b6d1d835d8c840bebbcd6cc0ee910f17da37caf8488afbc08397a1941fcc79e76a5888a95b3d5405e13f737bea5c78d716a48eb9dc0aec8de39c4b45c6914ad4a8185969f70b1adf46';

function bchex2dec($hex) {
  $dec = 0;
  $len = strlen($hex);
  for ($i = 0; $i < $len; $i++)
    $dec = bcadd($dec, bcmul(strval(hexdec($hex[$i])), bcpow('16', strval($len - 1 - $i))));
  return $dec;
}

function blind_sign($sk, $blinded_msg) {
  $time_start = microtime(true);
  $blind_sig = gmp_powm($blinded_msg, $sk[1], $sk[0]);
  $time_end = microtime(true);
  $execution_time = round($time_end - $time_start, 1);
  print("bcpowmod took $execution_time seconds<br>\n");
  return $blind_sig;
}

/*
$keyrsa = gmp_init("9832475748957245");
$p = gmp_init("8354079484936541914927899085066667840301483360503839666157604136172921017528434146469774903867827180301976075982694562560689572638988092925269813627463374625291252908846201647344151611753461104963119608859115640201075591792459197160119945258486367627500121879818096099203595248003716117545512480479865709921453");
$q = gmp_init("938412744368825581535702355433426163883459511114687878154024994897102350822189947166755477679382811899594449736937158715413660429942933801527664946168421987845759422078910224872347655774496994538836516350730448938820126252589141481797770481863822310785941175596494671215977389040699889153301120914503446716507973489992786954188813");
//$cq = "90158151585243433649068545530051893622966883012518795089220114585310968302320502026270948815940384941612296625138324093461024924511161402917200931834290201708637643850750136849813026570271943168694883902320057242885955055614162225328861522256625184296048689139146938390662090382632227663474386093495477914592794162872990148364116";
//$cp = "7551459988262214427840190779497680155475105762407164553046829825327340315927179742834418691277481624391481553210225801715295088793857458100116513396506530756291114733889990865992240204940649387943199598796499358274552099683283819575613245477264444414822005200002309824389674861969207905172310540069768226872734";
$dp = gmp_init("1965665761161539274100682137662745374188584320118550509684142149687746121771396269757594095027724042423994370819457544131926958267997198335357603206461970500068530096199106269963329791000814377638381084437438974164958962774696281684734104766702674735882381618780728493930257705412639086481297054230556637628577");
//$dq = "883211994700071135563013981584401095419726598696176826497905877550213977244414067921652214286477940611383011517117325849801092169358055342614272890511455988560714750191915505762209558375997171330669662447746304883595412943613309629927313394695362174857356400561406749379743424979482248614871643213650302792007504461169681839236529");
$qtcp = gmp_init("7086386291576524054360302742239998876673708944686465411626570038380444601875306630964988910095131487662281790536626963003506657704070876201964033331286024035984707744160238401059534677753482122942131531324658709164939274183600052634838272332743659199253932999987961039598035528397374750903876542815898982226118836076739179152436733287292195730452100700462917916533108208521409272086529455286245592495898895482186435700595327952372741822199742491182942283075691359064307215568687412510144120677674012937164826009435459181454662134489129797327892892707673596353503035243628926739960488503739316122718017371542430284689864394081681732757524742");
//$d = "9684180457578041703423518212984665367413021472235946617919642829863937153436059290504589391395592577209702599096169971796160405050131992497221547725184873244919981572828194571494694548428547986158684865534112722970807920768563560619443671077664354596805006314087514740257760893103656422610790000570529248962650590971772121591956305661910290201820155312347599369833629985907639681332639927293587022614471157370529051414542594064576484579816117675667970018652822901408587669420741843654459983059048798380989538136593189533517910165268761423288024908153885735118716648190934832866700250304833422760360615089471368245425769057619094702167123265";
$n = gmp_init("7839574656134605188485705220035205297429588810857671071649234671794615790876809901837048554939289229169759246887375691454034613612011612973941252920387754531601889844670443224543324158251681703080840129241900775738273078717408596691930590872394953721223100349499416694494377865845817104018258571890428439636432369199417038685736648639886105668941162211691589720601790029355870681555006383931825756229459276736474343941175285895314774582071354222952445036285378330268675333052497389891203339480294275218891997254728399246701139093936159885498019009817278067080240490608754607645219870614833288791258716931448852885321580818328787411561305289");
$ptcq = gmp_init("753188364558081134125402477795206420755879866171205660022664633414171189001503270872059644844157741507477456350748728450527955907940736771977219589101730495617182100510204823483789480498199580138708597917242066573333804533808544057092318539651294521969167349511455654896342337448442353114382029074529457410313533122677859533299915352593909938489061511228671804068681820834461409468476928645580163733560381254287908240579957942942032759871611731769502753209686971204368117483809977381059218802620262281727171245292940065246476959447030088170126117109604470726737455365125680905259382111093972668540699559906422600631716424247105678803780548");

$gmpPowm = gmp_powm(gmp_mod($keyrsa, $p), $dp, $p);
$gmpResult = gmp_mod(gmp_add(gmp_mul($qtcp, $gmpPowm), gmp_mul($ptcq, $gmpPowm)), $n);

$dec = gmp_strval($gmpResult);
*/

$time_start = microtime(true);
$test_sk = [gmp_init($test_n, 16), gmp_init($test_d, 16)];
$blinded_msg = gmp_init($test_blinded_msg);
$blind_sig = gmp_init($test_blind_sig);
$time_end = microtime(true);
$execution_time = round($time_end - $time_start, 1);
print("setup took $execution_time microseconds<br>\n");

if (blind_sign($test_sk, $blinded_msg) === $blind_sig)
  die("Success");
else
  die("Failure");

?>
