/* Material for the tense and voice drills (js/grammar-gen.js). Original sentences.
   verbs: base past pp. scenes: agent|中文|person|verb|中文动词|object|中文宾语|plural object|keep "by" in the passive|tenses that read oddly (optional).
   person: 1s I · 2 you · 3s he/she/it · 1p we · 3p they. be: subject|person|complement|span (optional):
   short = a passing state (today, yesterday), long = a lasting one (now, two years ago). */
window.GRAMMAR_DATA = {
  verbs: 'clean cleaned cleaned|build built built|write wrote written|repair repaired repaired|paint painted painted|wash washed washed|cook cooked cooked|'
    + 'deliver delivered delivered|plant planted planted|teach taught taught|make made made|grow grew grown|sell sold sold|send sent sent|steal stole stolen|'
    + 'check checked checked|translate translated translated|publish published published|design designed designed|open opened opened|close closed closed|'
    + 'answer answered answered|invite invited invited|choose chose chosen|take took taken|break broke broken|drive drove driven|speak spoke spoken|'
    + 'catch caught caught|buy bought bought|eat ate eaten|feed fed fed|water watered watered|cut cut cut|collect collected collected|produce produced produced|'
    + 'use used used|interview interviewed interviewed|print printed printed|record recorded recorded|test tested tested|serve served served|prepare prepared prepared|'
    + 'tidy tidied tidied|carry carried carried|plan planned planned|stop stopped stopped',
  scenes: [
    'my brother|我哥哥|3s|clean|打扫|the kitchen|厨房|0|0',
    'the workers|工人们|3p|build|建|houses|房子|1|0',
    'my mother|我妈妈|3s|cook|做|dinner|晚饭|0|1',
    'the students|学生们|3p|clean|打扫|the classroom|教室|0|0',
    'Mr Li|李老师|3s|teach|教|English|英语|0|1',
    'the postman|邮递员|3s|deliver|送|the letters|信件|1|0',
    'we|我们|1p|plant|种|trees|树|1|0',
    'the farmers|农民们|3p|grow|种植|rice|水稻|0|0',
    'this shop|这家店|3s|sell|卖|fresh fruit|新鲜水果|0|0',
    'I|我|1s|wash|洗|the dishes|碗|1|0',
    'they|他们|3p|paint|粉刷|the walls|墙|1|0',
    'the mechanic|修理工|3s|repair|修|the car|车|0|1',
    'the police|警察|3p|catch|抓住|the thief|小偷|0|1|pres',
    'she|她|3s|write|写|the report|报告|0|0',
    'the company|这家公司|3s|produce|生产|electric cars|电动汽车|1|0',
    'you|你|2|open|打开|the windows|窗户|1|0',
    'the cleaner|清洁工|3s|collect|收走|the rubbish|垃圾|0|0',
    'my father|我爸爸|3s|drive|开|the school bus|校车|0|1',
    'the nurses|护士们|3p|feed|喂|the babies|婴儿|1|0',
    'the gardener|园丁|3s|cut|修剪|the grass|草坪|0|0',
    'the teacher|老师|3s|check|检查|our homework|我们的作业|0|1',
    'the team|这个团队|3s|design|设计|the website|网站|0|0',
    'the translator|译者|3s|translate|翻译|the book|这本书|0|1|pres',
    'the reporters|记者们|3p|interview|采访|the players|球员|1|0',
    'we|我们|1p|invite|邀请|our neighbours|邻居|1|0',
    'I|我|1s|send|发|the emails|邮件|1|0',
    'the children|孩子们|3p|water|浇|the flowers|花|1|0',
    'someone|有人|3s|steal|偷|my bike|我的自行车|0|0|pres,fut',
    'the chef|厨师|3s|prepare|准备|the meals|饭菜|1|0',
    'my sister|我姐姐|3s|take|拍|the photos|照片|1|1',
    'the waiter|服务员|3s|serve|上|the food|菜|0|0',
    'the boy|那个男孩|3s|break|打破|the window|窗户|0|1|pres,prog,pprog,fut',
    'the factory|这家工厂|3s|make|生产|toys|玩具|1|0',
    'the staff|工作人员|3p|print|打印|the tickets|票|1|0',
    'the band|乐队|3s|record|录制|a new song|一首新歌|0|1',
    'the engineers|工程师们|3p|test|测试|the machines|机器|1|0',
    'he|他|3s|buy|买|the tickets|票|1|0',
    'the librarian|图书管理员|3s|close|关|the library|图书馆|0|0',
    'the students|学生们|3p|choose|选|the topics|话题|1|0',
    'my grandparents|我爷爷奶奶|3p|grow|种|vegetables|蔬菜|1|1',
    'the editor|编辑|3s|publish|出版|the magazine|杂志|0|0',
    'they|他们|3p|use|用|this room|这个房间|0|0',
    'my roommate|我室友|3s|tidy|整理|the room|房间|0|0',
    'the workers|工人们|3p|carry|搬|the boxes|箱子|1|0',
  ],
  be: [
    'I|1s|tired|short', 'my parents|3p|at home|short', 'the museum|3s|open|short', 'you|2|late|short', 'we|1p|busy', 'the tickets|3p|expensive',
    'she|3s|a doctor|long', 'the streets|3p|quiet', 'he|3s|in the library|short', 'the weather|3s|cold', 'they|3p|happy', 'it|3s|sunny|short',
    'my brother|3s|a student|long', 'the shops|3p|crowded', 'the exam|3s|difficult', 'our neighbours|3p|friendly|long',
  ],
  markers: {
    pres: ['every week|每周', 'every day|每天', 'on Sundays|每个星期天', 'once a month|每个月一次'],
    past: ['yesterday|昨天', 'last week|上周', 'two days ago|两天前', 'last night|昨晚'],
    prog: ['now|现在', 'at the moment|此刻', 'right now|这会儿'],
    pprog: ['at eight last night|昨晚八点', 'when I arrived|我到的时候', 'at this time yesterday|昨天这个时候'],
    perf: ['already|已经', 'recently|最近', 'this week|这周'],
    pperf: ['by the time we got home|我们到家的时候', 'before the guests arrived|客人到之前', 'by last Friday|到上周五'],
    fut: ['tomorrow|明天', 'next week|下周', 'soon|很快', 'in two days|两天后'],
    beP: ['today|今天|short', 'now|现在', 'this week|这周'],
    beS: ['yesterday|昨天|short', 'last night|昨晚|short', 'two years ago|两年前|long', 'last summer|去年夏天'],
  },
}
