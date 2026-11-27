/* 3S · Pros and cons 利弊类（学生版）讲义整理：结构模板、5 篇范文（去掉了课堂手写批注，
   范文里的错误在 fixes 里更正并说明）、讲义笔记和句型练习。Task 2 题目同时加入大作文题库。 */
window.PROS_CONS = {
  structure: [
    { name: '开头段', words: 40, role: '背景句 + 观点句（改写题目，表明立场）', groups: [
      { label: '背景句开头', items: ['In today\'s digitized society, ...', 'In recent times, ... / Recently, ...', 'In contemporary times, ...'] },
      { label: 'A. 题目是事实（fact）', items: ['It is widely acknowledged that ...', 'It is well-known that ...', 'It is a fact that ...', 'It is an undeniable fact that ...', 'It is true that ...', 'It is common that ...', 'It is undeniable that ...'] },
      { label: 'B. 题目是有争议的观点（opinion）', items: ['It is a contentious / controversial issue whether ... or ...', 'There are different opinions on whether ... or ...', 'There is a growing concern about whether ... or ...', 'It is argued that ...'] },
      { label: 'C. 观点句（利大于弊）', items: ['写法 1：This essay contends that the advantages of [主题] significantly outweigh its disadvantages.', '写法 2：Although there are some negative effects associated with [主题], the advantages generally / far outweigh the disadvantages.'] },
    ] },
    { name: '主体段 1：弊', words: 120, role: '主题句 + 2-3 个弊端，每个弊端都要展开', groups: [
      { label: '主题句', items: ['[主题] presents certain challenges / drawbacks that must be acknowledged.'] },
      { label: '论点 1', items: ['First of all / Primarily / First and foremost, ...', 'For example, ...', 'One of the primary drawbacks of this issue is that ...'] },
      { label: '论点 2（因果论证）', items: ['Additionally, ...', 'This + 名词 ... / These + 名词短语 ...（指代上一句）', '..., leading to / contributing to ...'] },
      { label: '论点 3', items: ['Finally, ..., which means / in other words, ...'] },
    ] },
    { name: '主体段 2：利', words: 140, role: '主题句 + 2-3 个好处，比弊端段写得更充分', groups: [
      { label: '主题句', items: ['A myriad of benefits arise from [主题].', '[主题] offers numerous significant advantages.'] },
      { label: '论点 1（解释论证）', items: ['The major benefit is that ...', 'To be specific, ...'] },
      { label: '论点 2（举例论证）', items: ['In addition / Besides, ...', 'For instance, ...'] },
      { label: '论点 3（指代、解释）', items: ['Furthermore / Last but not least, ...', 'These + 名词短语 / This + 名词 ...'] },
    ] },
    { name: '结尾段', words: 40, role: '总结 + 再次表明观点 + 建议（扬长避短）', groups: [
      { label: '第一句：总结并重申观点', items: ['To conclude / To sum up / To recapitulate / In conclusion / In summary / On the whole / On balance（利弊题常用）, ...', 'although / while ... A ..., ... B（支持的一方）... profound influence.'] },
      { label: '第二句：建议，升华', items: ['It is imperative / paramount for sb to do sth, (which ...,) thereby doing sth.'] },
    ] },
  ],
  essays: [
    { id: 'pc-1', title: '社交媒体', type: 'advantages',
      prompt: 'Many people around the world use social media every day to keep in touch with other people and get news events. Do you think the advantages outweigh the disadvantages?',
      paras: [
        ['intro', 'In today\'s rapidly developing world, advancements in technology and the rise of social media platforms have made it easier for people to communicate across long distances and stay updated with the latest news. Although there are some negative effects associated with these changes, the advantages generally outweigh the disadvantages.'],
        ['con', 'Let\'s begin with the downsides of social media and technology in people\'s lives. Nowadays, many individuals spend hours watching short videos such as Reels, YouTube Shorts, and TikTok clips. These videos attract viewers\' attention with trendy music and personalized recommendations. In addition to this, interactive online games are becoming increasingly popular, especially among the younger generation, who often find themselves playing them unintentionally for hours. As a result, people are glued to their phones most of the time. Since social media platforms offer content based on users\' tastes and preferences, many individuals become addicted and gradually disconnect from their surroundings. Consequently, many young people are no longer talking with their parents or spending time with their relatives. Even real-life friendships are being replaced by virtual ones through social media. Hence, conflicts between parents and teenagers, who are already going through the emotional challenges of puberty, are becoming more common these days.'],
        ['pro', 'One of the main advantages of social media is that it allows people to stay connected with relatives and friends who live far away. With the help of various platforms, individuals can communicate easily without the need to travel long distances. In addition, social media has become a source of income for many people. For example, bloggers now share their daily lives, travel experiences, and unboxing videos, gaining large audiences and earning even more than some office workers. Moreover, social media plays a significant role in international collaboration. When working with people from other countries, there is no longer a need for physical meetings, as online platforms enable effective communication through virtual meetings. Another benefit is seen in parenting: many young mothers find social media helpful when managing their children. For instance, when their babies cry or refuse to listen, mothers can play interactive cartoons or songs on YouTube, allowing them to relax for a short time.'],
        ['end', 'To summarise all of the above, although social media and technological advancements come with certain drawbacks, such as potential overuse or privacy concerns, their benefits in terms of communication, remote work opportunities, income generation, and everyday convenience clearly outweigh the disadvantages. As long as people use these tools wisely and in moderation, they can continue to enjoy the many positive impacts they bring to modern life.'],
      ],
      fixes: [
        ['Let\'s begin with the downsides', 'To begin with the drawbacks', 'Let\'s 是口语，学术写作不用缩写。'],
      ],
      notes: ['结构完全按模板：开头 → 弊 → 利 → 结尾。', '结尾提到的 privacy concerns 和 remote work 正文没有展开，结尾不要加新论点。', '原文 420 词偏长，考试 40 分钟内写 270-300 词更稳。', '课堂笔记：more and more popular 可以换成 become increasingly popular。'] },
    { id: 'pc-2', title: '冒险', type: 'advantages',
      prompt: 'It is important for people to take risks, both in their professional lives and their personal lives. Do you think the advantages of taking risks outweigh the disadvantages?',
      paras: [
        ['intro', 'It is often argued that taking risks in both professional and personal lives is essential. While there are potential disadvantages to risk-taking, I believe the benefits far outweigh them. Risks can not only prepare individuals for an unpredictable future but also foster a fearless mindset, both of which are crucial for personal and professional growth.'],
        ['pro', 'To begin with, taking risks opens up opportunities that can lead to a more prosperous future. The uncertainties of later stages in life mean that no one can predict what will happen. By embracing risks, people increase their chances of achieving success, even if the outcome is not guaranteed. For instance, if an individual decides to invest a portion of their earnings, despite the inherent risk of losing money, the potential return could be significant and life-changing. Without taking this risk, the money might otherwise be spent on non-essential activities, such as dining out or entertainment, which offer no long-term financial benefits. Similarly, in personal life, starting a new relationship involves the risk of emotional vulnerability. While there are no guarantees that a relationship will last or bring happiness, taking that leap often leads to growth and meaningful connections.'],
        ['pro', 'Furthermore, a fearless mindset, essential for both personal and professional success, is developed through risk-taking. People who consistently take risks are often more resilient and better equipped to handle challenges. Many successful leaders, for example, built their careers by confronting obstacles head-on rather than avoiding them. These individuals learned early on that facing uncertainties strengthens their problem-solving abilities and enables them to achieve their goals. The well-known saying "no risk, no gain" holds true, as those willing to take calculated risks often reap the rewards, developing a mindset that is critical for long-term success.'],
        ['concede', 'Admittedly, taking risks does carry the potential for failure or loss. There is always a chance that an investment may not yield returns or that a relationship may not work out. However, these potential drawbacks are outweighed by the personal growth and opportunities that come from stepping out of one\'s comfort zone. Without risk, people would remain stagnant, unable to adapt to the unpredictable nature of life. It is through risk-taking that individuals learn valuable lessons, regardless of the immediate outcome.'],
      ],
      fixes: [
        ['"no risk, no gain"', '"nothing ventured, nothing gained"', '常见说法是 nothing ventured, nothing gained 或 no pain, no gain；no risk, no gain 不是固定谚语。'],
      ],
      notes: ['另一种写法：开头 → 利 1 → 利 2 → 让步段（Admittedly ... However ...），先承认弊端，再说明弊端被好处抵消。', '这篇没有单独的结尾段，考试时最好补两句结尾，否则任务回应不完整。可以这样补：In conclusion, although taking risks may lead to failure or loss, the opportunities and personal growth it brings far outweigh these drawbacks. People should therefore be willing to take calculated risks.', '开头的 not only ... but also ...、both of which ... 和让步段的 It is through ... that ...（强调句）可以直接借用。'] },
    { id: 'pc-3', title: '年轻人口', type: 'advantages',
      prompt: 'At the present time, the population of some countries includes a relatively large number of young adults, compared with the number of older people. Do the advantages of this situation outweigh the disadvantages?',
      paras: [
        ['intro', 'Throughout the history of humanity, the significance of population demographics has been acknowledged as a critical determinant of a nation\'s strength or weakness. In contemporary times, many countries are characterized by a substantial proportion of young adults relative to older individuals. This essay contends that the advantages of such a demographic situation significantly outweigh the disadvantages.'],
        ['pro', 'A myriad of benefits arises from a predominantly youthful population. Primarily, a young demographic provides a robust workforce, capable of driving economic development and infrastructure enhancement. With a sizeable cohort of individuals under the age of 40, nations are well-equipped to engage in large-scale construction projects, such as the establishment of housing, hospitals, roads, and airports. Additionally, a younger populace contributes to national defense capabilities, as they fulfill military service obligations more effectively than older individuals. Moreover, with a lower average age, there is a reduced prevalence of age-related health issues, translating into fewer elderly individuals requiring care facilities. For instance, China\'s experience illustrates the merits of a youthful population; with a population exceeding 1.5 billion, the country has leveraged its considerable number of young people to achieve significant developmental milestones over the past several decades.'],
        ['con', 'Conversely, the youthful demographic presents certain challenges that must be acknowledged. One notable disadvantage is the scarcity of experience within the workforce. As younger individuals are still in the process of learning and acquiring skills, they may encounter difficulties in navigating complex developmental projects. This lack of experience can lead to inefficient resource management and budgetary oversights, with younger, less experienced individuals potentially making reckless decisions. Furthermore, the influx of young adults into the job market may outpace the availability of suitable employment opportunities, leading to high levels of underemployment and frustration among this demographic. Such challenges necessitate strategic planning and investment in education and vocational training to ensure that young individuals can transition smoothly into the workforce.'],
        ['end', 'In conclusion, while the prevalence of young adults in a population may present certain challenges, the advantages, particularly in terms of economic potential and national development, are profound. Therefore, it is imperative for countries to harness their youthful populations effectively, investing in education and infrastructure to foster sustainable growth and prosperity.'],
      ],
      fixes: [
        ['A myriad of benefits arises', 'A myriad of benefits arise', 'a myriad of + 复数名词，谓语用复数（讲义模板里也是 arise）。'],
        ['with a population exceeding 1.5 billion', 'with a population of about 1.4 billion', '中国人口约 14 亿，不到 15 亿；没把握的数据宁可不写具体数字。'],
      ],
      notes: ['这篇先利后弊。也可以把你支持的一方放在后面写，写得更充分。', '弊端段最后一句 Such challenges necessitate ... 给出解决办法，自然引出结尾的建议。', '讲义笔记：leverage = capitalize on = make use of = take advantage of = harness；populace = citizens = residents = the public；enhance = promote = boost；reckless = impulsive；encounter = meet；oversight（疏忽）；determinant（决定因素）。'] },
    { id: 'pc-4', title: '超市里的进口食品', type: 'advantages',
      prompt: 'In many countries nowadays, consumers can go to a supermarket and buy food produced all over the world. Do you think this is a positive or negative development?',
      paras: [
        ['intro', 'The globalization of the food industry has offered people a vast array of products from all over the world in local supermarkets. While this development may bring some drawbacks, I would contend that the benefits it yields are worth considering rather than its negative sides.'],
        ['con', 'On the one hand, proponents of the negative implications argue that importing foreign produce from long distances would cause environmental degradation due to the emission of toxic fumes into the environment. For instance, the fuel consumed by ships and airplanes while transporting food across continents significantly contributes to global warming and air pollution. Furthermore, the overreliance on imported products makes it harder for local farmers to compete with cheaper and mass-produced goods overseas. This, coupled with the considerable decline in local produce, may give rise to a loss of local specialties and food diversity.'],
        ['pro', 'Conversely, the argument in favor of buying imported food in supermarkets can be further fortified by the advantages it confers on consumer welfare. Having access to a global food market provides customers with a wide range of exotic cuisines, thereby enhancing their culinary experiences and cultural exposure. To exemplify, these days, if Vietnamese people want to enjoy a box of sushi from Japan, they can effortlessly purchase it from a local supermarket. Moreover, the international food trade stimulates economic growth. It boosts global trade and supports farmers in developing countries by providing them more opportunities to export their products. Not only does the import and distribution of food foster economic development in these nations, but it also creates numerous job opportunities in logistics and retail sectors.'],
        ['end', 'To conclude, while the global availability of food in local markets poses a threat to the environment and local agriculture, the positive sides it brings in terms of various food choices, economic growth and job opportunities are more significant.'],
      ],
      fixes: [
        ['I would contend that the benefits it yields are worth considering rather than its negative sides', 'I would contend that its benefits outweigh its drawbacks', '原句意思绕，没有直接回答“积极还是消极”。'],
        ['proponents of the negative implications argue', 'critics argue', 'proponent 是“支持者”，“消极影响的支持者”搭配不当。'],
        ['providing them more opportunities', 'providing them with more opportunities', 'provide sb with sth。'],
      ],
      notes: ['题型是“积极还是消极的发展”，写法和利弊类一样：承认弊端，论证好处更大。', 'thereby enhancing ... 和 Not only does ... but it also ...（倒装）是可以直接借用的句型。'] },
    { id: 'pc-5', title: '三十岁结婚生子', type: 'advantages',
      prompt: 'Today, most people get married and give birth in their thirties rather than when they are younger. Is this a positive or negative development?',
      paras: [
        ['intro', 'In contemporary society, a growing number of individuals are opting to marry and start a family in their thirties, as opposed to a younger age. In my opinion, this is certainly a positive development because, at this stage, people will be financially stable and more mature.'],
        ['pro', 'Firstly, when people are in their thirties, they have mostly already had a stable job. In other words, most of them have their own savings, insurance, house, or even cars. Due to this fact, they will be well-prepared to get married and have a comfortable life with their partners and future children. For example, in most developed countries, such as the United States, the majority of people choose to build their families only after they have bought their own properties because this will secure them a happy married life. Clearly, this cannot be achieved when people are still young. The possibility of divorce is very high when the breadwinner in the family is not providing enough for the household.'],
        ['pro', 'Secondly, when people are in their thirties, they are more mature. That is to say, they can handle conflicts better than those who are younger. This is because they are more calm, and they often discuss their problems in positive ways. Young people are usually egotistical, and they often make decisions without thinking about the consequences. Because of this, many people choose to separate, even over a simple argument.'],
        ['end', 'To sum up, I once again believe that getting married at the age of 30 is definitely a great thing because of financial security and maturity. Hence, people should change their perceptions about it.'],
      ],
      fixes: [
        ['they have mostly already had a stable job', 'most of them already have stable jobs', '“已经有”是现在的状态，用 have；most of them 放在主语位置更清楚。'],
        ['they are more calm', 'they are calmer', '单音节形容词用 -er 比较级。'],
        ['I once again believe', 'I firmly believe', 'once again believe 不自然。'],
      ],
      notes: ['两个主体段都写好处，是一边倒的写法；利弊类题目最好像前几篇一样承认弊端，回应更完整。', 'Clearly, this cannot be achieved ... 和 the majority of people ... 都是没有依据的绝对说法，容易被扣分。'] },
  ],
  notes: [
    { title: '同义替换', items: ['leverage = capitalize on = make use of = take advantage of = harness', 'populace = citizens = residents = the public', 'enhance = promote = boost', 'development = enhancement = advancement', 'reckless = impulsive', 'encounter = meet', 'become more and more popular → become increasingly popular'] },
    { title: '定语从句', items: ['限制性定语从句：起修饰、限定作用，不加逗号。I like a boy who likes me. / I like a boy whom (who) my parents like.', '非限制性定语从句：有逗号，起补充解释作用。Social media, which is used by billions, has changed communication.', '关系副词：I don\'t accept the reason why he came late. / I still remember the day when he took my backpack. / the place where ...'] },
    { title: '强调句 It is ... that / who ...', items: ['I love you at present. → It is at present that I love you.', '强调人可以用 who：It is I who love you. / It is you whom (who) I love.', '范文：It is through risk-taking that individuals learn valuable lessons.'] },
    { title: '表达结果的三种写法', items: ['..., thus / thereby leading to high levels of underemployment.（也可以 generating / producing）', '..., which leads to high levels of underemployment.', '..., so that it leads to high levels of underemployment.（讲义写法，语气较弱，前两种更常用）', 'as a result（副词，引出结果）/ as a result of = because of（介词，引出原因）'] },
  ],
  drills: [
    { cat: 'tpl', q: 'This essay contends that the advantages of online learning significantly ____ its disadvantages.', a: ['outweigh'] },
    { cat: 'tpl', q: 'Although there are some negative effects ____ with remote working, the advantages far outweigh the disadvantages.', a: ['associated'] },
    { cat: 'tpl', q: 'It is widely ____ that technology has transformed the way we live.', a: ['acknowledged', 'accepted', 'recognised', 'recognized', 'believed', 'agreed'] },
    { cat: 'tpl', q: 'It is a ____ issue whether children should use smartphones at school.', a: ['contentious', 'controversial', 'debatable'] },
    { cat: 'tpl', q: 'Remote working presents certain ____ that must be acknowledged.', a: ['challenges', 'drawbacks', 'disadvantages', 'downsides', 'problems'] },
    { cat: 'tpl', q: 'A ____ of benefits arise from international tourism.', a: ['myriad', 'multitude', 'host'] },
    { cat: 'tpl', q: 'Online learning ____ numerous significant advantages.', a: ['offers', 'provides', 'brings', 'has'] },
    { cat: 'tpl', q: 'On ____, although tourism brings some problems, its benefits have a more profound influence.', a: ['balance'] },
    { cat: 'tpl', q: 'It is ____ for governments to invest in public transport, thereby reducing traffic congestion.', a: ['imperative', 'essential', 'vital', 'crucial'] },
    { cat: 'tpl', q: 'It is imperative for schools to teach financial skills, ____ preparing students for adult life.', a: ['thereby'] },
    { cat: 'tpl', q: 'The major ____ is that people can work from anywhere.', a: ['benefit', 'advantage', 'merit', 'strength'] },
    { cat: 'tpl', q: 'First and ____, long working hours damage people\'s health.', a: ['foremost'] },
    { cat: 'syn', q: '写出 leverage 的一个同义表达', a: ['capitalize on', 'capitalise on', 'make use of', 'take advantage of', 'harness', 'exploit', 'utilize', 'utilise'] },
    { cat: 'syn', q: '写出 populace 的一个同义词', a: ['citizens', 'residents', 'the public', 'people', 'population', 'inhabitants'] },
    { cat: 'syn', q: '写出 enhance 的一个同义词', a: ['promote', 'boost', 'improve', 'strengthen', 'increase'] },
    { cat: 'syn', q: '写出 reckless 的一个同义词', a: ['impulsive', 'careless', 'rash', 'irresponsible'] },
    { cat: 'syn', q: '写出 encounter（动词）的一个同义词', a: ['meet', 'face', 'come across', 'experience', 'run into'] },
    { cat: 'syn', q: '把 become more and more popular 换成更书面的说法', a: ['become increasingly popular', 'increasingly popular', 'gain popularity', 'grow in popularity', 'become ever more popular'] },
    { cat: 'syn', q: '写出 development 的一个同义名词', a: ['enhancement', 'advancement', 'progress', 'growth', 'improvement'] },
    { cat: 'cleft', q: '强调 at present：I love you at present.', a: ['It is at present that I love you.'] },
    { cat: 'cleft', q: '强调 risk-taking：Risk-taking teaches people valuable lessons.', a: ['It is risk-taking that teaches people valuable lessons.'] },
    { cat: 'cleft', q: '强调 young people：Young people drive economic growth.', a: ['It is young people who drive economic growth.', 'It is young people that drive economic growth.'] },
    { cat: 'cleft', q: '强调 from failure：We learn most from failure.', a: ['It is from failure that we learn most.'] },
    { cat: 'cleft', q: '强调 through education：Countries escape poverty through education.', a: ['It is through education that countries escape poverty.'] },
    { cat: 'result', q: '用 thereby 合并：Young adults may outnumber available jobs. This leads to high underemployment.', a: ['Young adults may outnumber available jobs, thereby leading to high underemployment.', 'Young adults may outnumber available jobs, thus leading to high underemployment.'] },
    { cat: 'result', q: '用 which 合并：Young adults may outnumber available jobs. This leads to high underemployment.', a: ['Young adults may outnumber available jobs, which leads to high underemployment.'] },
    { cat: 'result', q: '用 thereby 合并：Governments invest in public transport. This reduces traffic congestion.', a: ['Governments invest in public transport, thereby reducing traffic congestion.', 'Governments invest in public transport, thus reducing traffic congestion.'] },
    { cat: 'result', q: '用 which 合并：Many people work from home. This saves commuting time.', a: ['Many people work from home, which saves commuting time.'] },
    { cat: 'rel', q: '合并成一句：I like a boy. My parents like him.', a: ['I like a boy who my parents like.', 'I like a boy whom my parents like.', 'I like a boy that my parents like.', 'I like a boy my parents like.'] },
    { cat: 'rel', q: '合并成一句：I still remember the day. He took my backpack on that day.', a: ['I still remember the day when he took my backpack.', 'I still remember the day on which he took my backpack.'] },
    { cat: 'rel', q: '合并成一句：I don\'t accept the reason. He came late for that reason.', a: ['I don\'t accept the reason why he came late.', 'I don\'t accept the reason for which he came late.', 'I don\'t accept the reason that he came late.', 'I don\'t accept the reason he came late.'] },
    { cat: 'rel', q: '用非限制性定语从句合并：Social media has changed communication. It is used by billions.', a: ['Social media, which is used by billions, has changed communication.'] },
    { cat: 'rel', q: '合并成一句：This is the town. I grew up in this town.', a: ['This is the town where I grew up.', 'This is the town in which I grew up.', 'This is the town that I grew up in.', 'This is the town which I grew up in.'] },
  ],
  drillCats: { tpl: '模板填空', syn: '同义替换', cleft: '强调句', result: '结果表达', rel: '定语从句' },
  roles: { intro: '开头', con: '弊', pro: '利', concede: '让步', end: '结尾' },
  highlight: ['This essay contends that', 'outweigh the disadvantages', 'outweigh them', 'negative effects associated with', 'presents certain challenges that must be acknowledged', 'A myriad of benefits', 'One of the main advantages of', 'Primarily', 'Additionally', 'Furthermore', 'Moreover', 'In addition', 'For example', 'For instance', 'To exemplify', 'Consequently', 'As a result', 'Hence', 'Conversely', 'On the one hand', 'Admittedly', 'However', 'Similarly', 'To begin with', 'Firstly', 'Secondly', 'In other words', 'That is to say', 'To summarise', 'To conclude', 'To sum up', 'In conclusion', 'it is imperative for', 'thereby', 'leading to', 'It is through', 'not only', 'Not only does', 'both of which', 'It is often argued that', 'Throughout the history of humanity', 'In contemporary times', 'In contemporary society'],
}
// The handout prompts join the Task 2 bank.
;(function () {
  const W = window.WRITING_DATA
  if (W && W.task2) {
    for (const e of window.PROS_CONS.essays) {
      if (!W.task2.some(p => p.id === e.id))
        W.task2.push({ id: e.id, type: e.type, prompt: e.prompt, pc: true })
    }
  }
})()
