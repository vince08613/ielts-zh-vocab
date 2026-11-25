/* Original Academic Reading practice test (3 passages, 40 questions), written for this site.
   Every answer has an evidence quote that appears word for word in its paragraph
   (checked by tools/test-skills.mjs). */
window.READING_DATA = {
  passages: [
    {
      id: 'p1',
      title: 'Spacing Out Memory',
      topic: '心理学 · 记忆',
      minutes: 20,
      paragraphs: [
        ['A', 'Between 1879 and 1885, the German psychologist Hermann Ebbinghaus set out to measure something that most people assumed could not be measured: how quickly we forget. Working alone and using himself as his only subject, he memorised long lists of nonsense syllables, short invented combinations of letters such as ‘dax’ and ‘bup’. He chose meaningless items deliberately, reasoning that real words would carry associations that differed from one learner to another and would therefore distort the results. His findings appeared in 1885 in a book titled Über das Gedächtnis, or ‘On Memory’.'],
        ['B', 'Ebbinghaus did not simply ask himself whether he could still remember a list. Instead, he recorded how long it took him to relearn it. If a list that had originally required twenty minutes of study could be relearned in twelve minutes a day later, the eight minutes saved showed that some trace of the first learning remained. Using this ‘savings’ method, he found that forgetting was most rapid in the first hour after learning and slowed down considerably after that, a pattern now known as the forgetting curve. When researchers in the Netherlands repeated his procedure in 2015, their results closely matched the curve he had drawn more than a century earlier.'],
        ['C', 'A second discovery has had an even greater practical influence. Ebbinghaus noticed that spreading repetitions over several days was more efficient than concentrating them into a single session. This ‘spacing effect’ has since been confirmed in hundreds of experiments, with learners of all ages and with materials ranging from foreign vocabulary to medical procedures. In one large online study published in 2008, more than a thousand adults learned a set of obscure facts and reviewed them after gaps of different lengths before taking a final test. The best gap was not fixed: the further away the test, the longer the ideal interval between study sessions, although the interval grew more slowly than the delay itself.'],
        ['D', 'Why should spacing help? One explanation is that a review which comes too soon is too easy. When information is still fresh, recognising it requires little effort, and the brain treats the second encounter as largely redundant. When some forgetting has occurred, retrieving the item takes work, and that effort appears to strengthen the memory more than effortless repetition does. Psychologists sometimes describe such obstacles as ‘desirable difficulties’: conditions that slow learning down in the short term but improve long-term retention.'],
        ['E', 'Closely related is the testing effect. In a well-known experiment reported in 2006, students read short prose passages and then either read them again or tried to recall them in writing. Five minutes later the re-readers performed slightly better, but after a week the pattern was reversed, and the students who had practised recalling remembered considerably more. The re-readers, however, had expected to do better. Re-reading creates a feeling of familiarity that learners easily mistake for knowledge.'],
        ['F', 'These findings have shaped the design of many study tools. Flashcard programs, for example, schedule each item for review shortly before it is likely to be forgotten, and lengthen the interval each time it is recalled correctly. Yet the research also carries a warning. The schedules such programs use are approximations rather than laws of nature: the original curve was based on a single learner memorising meaningless material, and real words, which connect to what a learner already knows, tend to be forgotten more slowly. The most reliable lessons may be the simplest ones: review material more than once, leave time between reviews, and test yourself instead of merely rereading.'],
      ],
      groups: [
        {
          type: 'tfng', from: 1, to: 6,
          instruction: 'Do the following statements agree with the information given in the passage? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.',
          questions: [
            { n: 1, text: 'Ebbinghaus used nonsense syllables because he believed real words would affect different learners in different ways.', answer: ['TRUE'], para: 'A', evidence: 'real words would carry associations that differed from one learner to another', pair: ['affect different learners in different ways', 'associations that differed from one learner to another'], explain: '原文说真实单词会带来“因人而异的联想”，从而干扰结果，和题干一致。' },
            { n: 2, text: 'Ebbinghaus tested a large group of volunteers to make his results more reliable.', answer: ['FALSE'], para: 'A', evidence: 'using himself as his only subject', pair: ['a large group of volunteers', 'himself as his only subject'], explain: '他只用自己做被试，和“一大群志愿者”直接矛盾。' },
            { n: 3, text: 'Ebbinghaus found that the speed of forgetting decreased after the first hour.', answer: ['TRUE'], para: 'B', evidence: 'forgetting was most rapid in the first hour after learning and slowed down considerably after that', pair: ['the speed of forgetting decreased', 'slowed down considerably'], explain: '第一小时遗忘最快，之后明显变慢，即遗忘速度下降。' },
            { n: 4, text: 'The researchers who repeated the procedure in 2015 tested more people than Ebbinghaus did.', answer: ['NOT GIVEN'], para: 'B', evidence: 'When researchers in the Netherlands repeated his procedure in 2015', pair: ['tested more people', '（原文没有提到被试人数）'], explain: '原文只说 2015 年有人重复了实验、结果吻合，没说用了多少被试。题干比较的信息不存在。' },
            { n: 5, text: 'The spacing effect has only been shown with language-learning materials.', answer: ['FALSE'], para: 'C', evidence: 'materials ranging from foreign vocabulary to medical procedures', pair: ['only language-learning materials', 'from foreign vocabulary to medical procedures'], explain: '材料从外语单词到医疗操作都有，不只是语言材料。only 是常见的错误信号词。' },
            { n: 6, text: 'All of the participants in the 2008 study were university students.', answer: ['NOT GIVEN'], para: 'C', evidence: 'more than a thousand adults learned a set of obscure facts', pair: ['university students', 'adults'], explain: '原文只说是一千多名成年人，没有说他们是不是大学生。adults 不能推出 university students，也不矛盾。' },
          ],
        },
        {
          type: 'gap', from: 7, to: 10, words: 2,
          instruction: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
          questions: [
            { n: 7, text: 'Ebbinghaus measured memory by recording the time he needed to ______ a list.', answer: ['relearn'], para: 'B', evidence: 'he recorded how long it took him to relearn it', pair: ['the time he needed to', 'how long it took him to'], explain: '“记录需要多长时间”对应 how long it took him，空格填动词 relearn。' },
            { n: 8, text: 'The pattern in which forgetting is fast at first and then slows down is known as the ______.', answer: ['forgetting curve'], para: 'B', evidence: 'a pattern now known as the forgetting curve', pair: ['is known as', 'now known as'], explain: '题干已有 the，答案写 forgetting curve 两个词。' },
            { n: 9, text: 'A review that comes too soon is too ______ to strengthen memory very much.', answer: ['easy'], para: 'D', evidence: 'a review which comes too soon is too easy', pair: ['comes too soon', 'comes too soon'], explain: '原句几乎照搬，难点是找到 D 段这一句。' },
            { n: 10, text: 'Conditions that slow learning at first but help long-term memory are called ______.', answer: ['desirable difficulties'], para: 'D', evidence: 'desirable difficulties', pair: ['help long-term memory', 'improve long-term retention'], explain: 'retention 是 memory 的同义替换；术语 desirable difficulties 正好两个词。' },
          ],
        },
        {
          type: 'mc', from: 11, to: 13,
          instruction: 'Choose the correct letter, A, B, C or D.',
          questions: [
            { n: 11, text: 'What did the 2008 study find about the best gap between study sessions?', options: ['It was the same whatever the date of the final test.', 'It became longer as the final test became more distant.', 'It was always about one day.', 'It mattered less than the number of reviews.'], answer: ['B'], para: 'C', evidence: 'the further away the test, the longer the ideal interval between study sessions', pair: ['became longer as the final test became more distant', 'the further away the test, the longer the ideal interval'], explain: 'A 与 The best gap was not fixed 矛盾；C、D 原文没有。' },
            { n: 12, text: 'In the 2006 experiment, the students who re-read the passages', options: ['remembered more after one week.', 'took longer to complete the task.', 'were tested only once.', 'were more confident than their final results justified.'], answer: ['D'], para: 'E', evidence: 'The re-readers, however, had expected to do better.', pair: ['more confident than their final results justified', 'had expected to do better'], explain: '重读组以为自己会考得更好，但一周后反而记得更少。A 说反了；B、C 原文没有。' },
            { n: 13, text: 'What is the writer’s main point in paragraph F?', options: ['Flashcard programs are based on a mistaken theory.', 'Real words are harder to remember than nonsense syllables.', 'Review schedules should be treated as useful estimates.', 'Learners should avoid testing themselves.'], answer: ['C'], para: 'F', evidence: 'The schedules such programs use are approximations rather than laws of nature', pair: ['useful estimates', 'approximations rather than laws of nature'], explain: '作者肯定这些工具，但提醒时间表只是近似值。A 说过头了；B 与“真实单词忘得更慢”相反；D 与最后一句相反。' },
          ],
        },
      ],
    },
    {
      id: 'p2',
      title: 'Cooling the City',
      topic: '环境 · 城市规划',
      minutes: 20,
      paragraphs: [
        ['A', 'On a still summer evening, the centre of a large city can be several degrees warmer than the farmland that surrounds it. Meteorologists call this the urban heat island effect. It was first described in the early nineteenth century, when an amateur scientist recorded that London was regularly warmer than the nearby countryside, and it has since been measured in cities on every inhabited continent. What has changed is its importance. As more of the world’s population moves into cities and heatwaves become more frequent, the extra warmth of the urban environment has turned from a scientific curiosity into a public health concern.'],
        ['B', 'The main cause lies in the materials from which cities are built. Asphalt, concrete and dark roofing absorb a large share of the sunlight that falls on them and store it as heat. Natural surfaces behave differently. Soil and plants hold water, and when that water evaporates it carries heat away, in the same way that sweat cools the skin. A city replaces much of this moist, living surface with dry, sealed ground, so less of the sun’s energy is spent on evaporation and more of it warms the air.'],
        ['C', 'The shape of a city also matters. Where tall buildings line narrow streets, heat radiated from one wall is absorbed by the wall opposite instead of escaping to the sky. Air movement is reduced, so warm air lingers. Added to this is the heat released by human activity: vehicles, industrial processes and, ironically, the air-conditioning units that people install to escape the heat, which pump warmth from inside buildings into the streets outside.'],
        ['D', 'Perhaps surprisingly, the difference between city and countryside is often greatest not in the afternoon but at night. During the day, both rural and urban areas heat up. After sunset, open fields lose their heat quickly, while the heat stored in buildings and roads is released slowly over many hours. For residents, this night-time warmth is more than a matter of comfort. Bodies that cannot cool down overnight have little chance to recover from the heat of the day, which is one reason why elderly people living alone in upper-floor flats are among those most at risk during heatwaves.'],
        ['E', 'Several remedies are already in use. The simplest is to change the colour of roofs: a white or reflective roof can stay much cooler than a dark one on a sunny day, and it costs relatively little to apply. Planting trees and creating parks provide shade and restore some of the evaporation that the city has lost. Green roofs, covered with soil and low-growing plants, insulate the buildings beneath them as well as cooling the air.'],
        ['F', 'None of these measures, however, is free of drawbacks. Reflective roofs reduce the need for cooling in summer but can increase heating costs in cold winters, so their value depends on the local climate. Trees need water, which may be scarce in hot, dry cities, and they take years to reach a useful size. Green roofs are heavy and expensive to install on existing buildings. For this reason, planners increasingly argue that there is no single solution, and that each neighbourhood requires a combination of measures suited to its climate, its buildings and the people who live there.'],
      ],
      groups: [
        {
          type: 'heading', from: 14, to: 18,
          instruction: 'The passage has six paragraphs, A–F. Choose the correct heading for paragraphs B–F from the list of headings below. Write the correct number, i–viii. Paragraph A has been done as an example: i.',
          options: ['A long-known problem that has become more serious', 'Why every approach has costs as well as benefits', 'Measuring the temperature of city streets', 'The time of day when the contrast peaks', 'How air conditioning helps to solve the problem', 'Simple measures that are already available', 'How the layout of a city and daily activity add warmth', 'Surfaces that store heat and the loss of natural cooling'],
          questions: [
            { n: 14, text: 'Paragraph B', answer: ['viii'], para: 'B', evidence: 'The main cause lies in the materials from which cities are built.', pair: ['surfaces that store heat', 'absorb a large share of the sunlight ... and store it as heat'], explain: 'B 段先讲建筑材料吸热储热，再讲失去植物和土壤的蒸发降温。' },
            { n: 15, text: 'Paragraph C', answer: ['vii'], para: 'C', evidence: 'The shape of a city also matters.', pair: ['layout of a city', 'shape of a city'], explain: 'C 段讲城市形状（窄街高楼）和人类活动产热。v 是陷阱：原文说空调 ironically（讽刺的是）反而向街道排热。' },
            { n: 16, text: 'Paragraph D', answer: ['iv'], para: 'D', evidence: 'the difference between city and countryside is often greatest not in the afternoon but at night', pair: ['the contrast peaks', 'the difference ... is often greatest'], explain: 'D 段主旨是城乡温差在夜里最大，以及夜间高温对健康的影响。' },
            { n: 17, text: 'Paragraph E', answer: ['vi'], para: 'E', evidence: 'Several remedies are already in use.', pair: ['measures that are already available', 'remedies are already in use'], explain: 'remedies = measures，already in use = already available。' },
            { n: 18, text: 'Paragraph F', answer: ['ii'], para: 'F', evidence: 'None of these measures, however, is free of drawbacks.', pair: ['costs as well as benefits', 'free of drawbacks'], explain: 'F 段逐一说明每种方法的缺点，结论是没有单一方案。' },
          ],
        },
        {
          type: 'gap', from: 19, to: 22, words: 1,
          instruction: 'Complete the sentences below. Choose ONE WORD ONLY from the passage for each answer.',
          questions: [
            { n: 19, text: 'Natural surfaces cool the air because the water they hold ______.', answer: ['evaporates'], para: 'B', evidence: 'when that water evaporates it carries heat away', pair: ['cool the air', 'carries heat away'], explain: '空格前是主语 the water they hold，缺谓语动词；water 不可数，用第三人称单数 evaporates。' },
            { n: 20, text: 'In narrow streets, heat from one wall is ______ by the wall on the other side.', answer: ['absorbed'], para: 'C', evidence: 'heat radiated from one wall is absorbed by the wall opposite', pair: ['the wall on the other side', 'the wall opposite'], explain: '被动结构 is ______ by，填过去分词 absorbed。' },
            { n: 21, text: 'Air-conditioning units move heat from inside buildings into the ______.', answer: ['streets'], para: 'C', evidence: 'pump warmth from inside buildings into the streets outside', pair: ['move heat', 'pump warmth'], explain: 'heat = warmth，move = pump。注意写复数 streets。' },
            { n: 22, text: 'After sunset, open fields lose their heat ______, but buildings release it slowly.', answer: ['quickly'], para: 'D', evidence: 'open fields lose their heat quickly', pair: ['lose their heat', 'lose their heat'], explain: '与后半句 slowly 形成对比，填副词 quickly。' },
          ],
        },
        {
          type: 'ynng', from: 23, to: 26,
          instruction: 'Do the following statements agree with the claims of the writer? Write YES if the statement agrees with the claims of the writer, NO if the statement contradicts the claims of the writer, NOT GIVEN if it is impossible to say what the writer thinks about this.',
          questions: [
            { n: 23, text: 'The urban heat island effect is now a matter of public health as well as scientific interest.', answer: ['YES'], para: 'A', evidence: 'has turned from a scientific curiosity into a public health concern', pair: ['a matter of public health', 'a public health concern'], explain: '作者明确说它已从科学好奇变成公共健康问题。' },
            { n: 24, text: 'The temperature difference between cities and the countryside is usually largest in the afternoon.', answer: ['NO'], para: 'D', evidence: 'often greatest not in the afternoon but at night', pair: ['largest in the afternoon', 'greatest not in the afternoon but at night'], explain: '原文说温差最大的时候不是下午而是夜里，直接矛盾。' },
            { n: 25, text: 'Reflective roofs are a good choice in every climate.', answer: ['NO'], para: 'F', evidence: 'their value depends on the local climate', pair: ['in every climate', 'depends on the local climate'], explain: '冬冷地区会增加取暖费用，作者认为价值取决于当地气候。' },
            { n: 26, text: 'Green roofs cool the air more effectively than trees do.', answer: ['NOT GIVEN'], para: 'E', evidence: 'Green roofs, covered with soil and low-growing plants, insulate the buildings beneath them as well as cooling the air.', pair: ['more effectively than trees', '（原文没有比较两者的效果）'], explain: '原文分别介绍了树和绿色屋顶，但没有比较哪个降温更好。' },
          ],
        },
      ],
    },
    {
      id: 'p3',
      title: 'The Box that Changed Trade',
      topic: '经济 · 科技史',
      minutes: 20,
      paragraphs: [
        ['A', 'For most of history, loading a ship was slow, expensive and dangerous work. Cargo arrived at the docks in barrels, sacks and crates of every size, and teams of dockworkers carried it piece by piece into the hold, where it had to be packed by hand so that it would not shift at sea. A vessel could spend as long in port being loaded and unloaded as it spent sailing between ports. Theft was common, and so were injuries.'],
        ['B', 'The man usually credited with changing this was not a sailor but an American trucking businessman, Malcom McLean. Frustrated by the hours his drivers spent waiting at ports, he began to wonder why the trailer of a truck could not simply be lifted onto a ship, box and all. In April 1956 a converted tanker called the Ideal X sailed from Newark, New Jersey, to Houston, Texas, carrying fifty-eight such boxes on a specially built deck. When the ship arrived, the containers were lifted off and attached to trucks that carried them straight to their destinations.'],
        ['C', 'The savings were dramatic. According to one estimate made at the time, loading loose cargo onto a ship of that kind cost several dollars per ton, while loading the containers cost only a small fraction of that amount. Ships could now be turned around in hours rather than days, which meant that each ship could make more voyages every year. Because a sealed container was opened only at the end of its journey, losses from theft fell sharply as well.'],
        ['D', 'Yet the container did not spread quickly. Each shipping company at first used boxes of its own design, and a container built for one firm’s ships could not be handled by another firm’s cranes or trucks. Ports, too, needed enormous investment in new cranes and storage areas, and many older city-centre docks had no room for them. It was not until international standards for container sizes were agreed in the late 1960s that boxes could move freely between companies, countries and forms of transport.'],
        ['E', 'The consequences reached far beyond the docks. As the cost of moving goods fell, it became economical for manufacturers to build factories wherever wages or materials were cheapest and to ship components across oceans for assembly. Many economists regard the container as one of the forces behind the growth of global supply chains in the second half of the twentieth century. At the same time, the traditional dock labour force shrank dramatically, and port cities such as London and New York saw their old waterfronts decline as shipping moved to new, larger terminals elsewhere.'],
        ['F', 'Today, most of the manufactured goods that cross the oceans travel in containers, and the largest ships can carry the equivalent of more than twenty thousand standard boxes. The success of the system has also revealed its weaknesses. Because so much depends on a small number of very large ports and vessels, a single disruption, such as a blocked canal or a closed port, can delay deliveries around the world for months. The humble box made global trade cheaper and faster, but it also made it more tightly connected than ever before.'],
      ],
      groups: [
        {
          type: 'para', from: 27, to: 31,
          instruction: 'The passage has six paragraphs, A–F. Which paragraph contains the following information? Write the correct letter, A–F.',
          questions: [
            { n: 27, text: 'an explanation of why early containers could not be used by every company', answer: ['D'], para: 'D', evidence: 'a container built for one firm’s ships could not be handled by another firm’s cranes or trucks', pair: ['could not be used by every company', 'could not be handled by another firm’s cranes'], explain: '各公司箱子规格不同，别家的设备无法装卸。' },
            { n: 28, text: 'a description of the first voyage of a ship carrying containers', answer: ['B'], para: 'B', evidence: 'In April 1956 a converted tanker called the Ideal X sailed from Newark', pair: ['the first voyage', 'In April 1956 ... sailed from Newark'], explain: 'B 段描述 1956 年 Ideal X 的航行。' },
            { n: 29, text: 'the effect of cheaper transport on where factories were built', answer: ['E'], para: 'E', evidence: 'it became economical for manufacturers to build factories wherever wages or materials were cheapest', pair: ['where factories were built', 'build factories wherever wages or materials were cheapest'], explain: '运输变便宜后，工厂可以建在成本最低的地方。' },
            { n: 30, text: 'an example of how one event can disrupt trade across the world', answer: ['F'], para: 'F', evidence: 'a single disruption, such as a blocked canal or a closed port, can delay deliveries around the world for months', pair: ['one event', 'a single disruption'], explain: '一条运河堵塞或一个港口关闭就能让全球交货延误数月。' },
            { n: 31, text: 'a description of how cargo was handled before containers existed', answer: ['A'], para: 'A', evidence: 'teams of dockworkers carried it piece by piece into the hold', pair: ['how cargo was handled', 'carried it piece by piece ... packed by hand'], explain: 'A 段描述集装箱出现前码头工人逐件搬运、手工码放。' },
          ],
        },
        {
          type: 'multi', from: 32, to: 33, pick: 2,
          instruction: 'Choose TWO letters, A–E. Which TWO reasons does the writer give for the slow spread of containers?',
          options: ['Dockworkers refused to handle the new boxes.', 'Companies used containers of different designs.', 'Ships were too small to carry them.', 'Ports needed expensive new equipment.', 'Governments placed taxes on container traffic.'],
          questions: [
            { n: 32, text: 'Reason 1', answer: ['B', 'D'], para: 'D', evidence: 'Each shipping company at first used boxes of its own design', pair: ['containers of different designs', 'boxes of its own design'], explain: '两个原因都在 D 段：各公司规格不统一（B），港口需要巨额投资新设备（D）。A、C、E 原文没有。两题答案顺序不限。' },
            { n: 33, text: 'Reason 2', answer: ['B', 'D'], para: 'D', evidence: 'Ports, too, needed enormous investment in new cranes and storage areas', pair: ['expensive new equipment', 'enormous investment in new cranes'], explain: '同上，两题答 B 和 D，顺序不限。' },
          ],
        },
        {
          type: 'box', from: 34, to: 37,
          instruction: 'Complete the summary using the list of words, A–H, below. Write the correct letter, A–H.',
          summary: 'McLean’s idea came from his frustration with the 34 ______ that truck drivers spent at ports. Containers greatly reduced the 35 ______ of loading a ship, and because ships spent less time in port, each one could complete more 36 ______ every year. However, containers could only move freely once international 37 ______ had been agreed.',
          options: ['voyages', 'standards', 'hours', 'cost', 'cranes', 'drivers', 'profits', 'routes'],
          questions: [
            { n: 34, text: '34', answer: ['C'], para: 'B', evidence: 'Frustrated by the hours his drivers spent waiting at ports', pair: ['frustration with', 'Frustrated by'], explain: 'C hours。注意 drivers 已在题干里，不能再选 F。' },
            { n: 35, text: '35', answer: ['D'], para: 'C', evidence: 'loading the containers cost only a small fraction of that amount', pair: ['greatly reduced the cost', 'only a small fraction of that amount'], explain: 'D cost。' },
            { n: 36, text: '36', answer: ['A'], para: 'C', evidence: 'each ship could make more voyages every year', pair: ['complete more voyages', 'make more voyages'], explain: 'A voyages。' },
            { n: 37, text: '37', answer: ['B'], para: 'D', evidence: 'international standards for container sizes were agreed in the late 1960s', pair: ['had been agreed', 'were agreed'], explain: 'B standards。' },
          ],
        },
        {
          type: 'mc', from: 38, to: 40,
          instruction: 'Choose the correct letter, A, B, C or D.',
          questions: [
            { n: 38, text: 'Why does the writer mention London and New York?', options: ['to illustrate the decline of old port areas', 'to show where the first containers were built', 'to compare the size of their modern terminals', 'to explain why standards were introduced'], answer: ['A'], para: 'E', evidence: 'port cities such as London and New York saw their old waterfronts decline', pair: ['the decline of old port areas', 'their old waterfronts decline'], explain: 'waterfronts = port areas，举例说明老港区衰落。' },
            { n: 39, text: 'According to paragraph F, the container system today', options: ['is less important than it was in the 1960s.', 'is no longer at risk of disruption.', 'carries only a small share of manufactured goods.', 'depends heavily on a small number of large ports and ships.'], answer: ['D'], para: 'F', evidence: 'so much depends on a small number of very large ports and vessels', pair: ['depends heavily on', 'so much depends on'], explain: 'vessels = ships。B、C 与原文相反；A 原文没有比较。' },
            { n: 40, text: 'What is the writer’s overall view of the container?', options: ['It harmed more people than it helped.', 'Its importance has been greatly exaggerated.', 'It brought benefits but also new risks.', 'It was the only cause of global supply chains.'], answer: ['C'], para: 'F', evidence: 'The humble box made global trade cheaper and faster, but it also made it more tightly connected than ever before.', pair: ['benefits but also new risks', 'cheaper and faster, but ... more tightly connected'], explain: '最后一句先肯定好处，再指出系统更脆弱。D 错在 only：原文说 one of the forces。' },
          ],
        },
      ],
    },
  ],
}
