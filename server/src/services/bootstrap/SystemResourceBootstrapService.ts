import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { BUILT_IN_STORY_MODE_SEEDS, type StoryModeSeedNode } from "../../db/storyModeSeeds";
import {
  DEFAULT_ANTI_AI_RULES,
  DEFAULT_STARTER_STYLE_PROFILES,
  DEFAULT_STYLE_TEMPLATES,
  type DefaultAntiAiRuleDefinition,
  type DefaultStarterStyleProfileDefinition,
  type DefaultTemplateDefinition,
} from "../styleEngine/defaults";
import { serializeJson } from "../styleEngine/helpers";
import { serializeStoryModeProfile } from "../storyMode/storyModeProfile";

export type SystemResourceSeedMode = "missing_only" | "sync_existing";

const STARTER_STYLE_PROFILE_SOURCE_PREFIX = "starter-style-profile:";

interface GenreSeedNode {
  id: string;
  name: string;
  description: string;
  template: string;
  children?: GenreSeedNode[];
}

const CJK_TEXT_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff]/u;

function containsCjkText(value: string | null | undefined): boolean {
  return Boolean(value && CJK_TEXT_PATTERN.test(value));
}

export interface StyleEngineSeedReport {
  styleTemplatesCreated: number;
  styleTemplatesUpdated: number;
  antiAiRulesCreated: number;
  antiAiRulesUpdated: number;
  styleProfilesCreated: number;
  styleProfilesUpdated: number;
}

export interface SystemResourceBootstrapReport extends StyleEngineSeedReport {
  genresCreated: number;
  genresUpdated: number;
  storyModesCreated: number;
  storyModesUpdated: number;
}

const EMPTY_STYLE_ENGINE_REPORT: StyleEngineSeedReport = {
  styleTemplatesCreated: 0,
  styleTemplatesUpdated: 0,
  antiAiRulesCreated: 0,
  antiAiRulesUpdated: 0,
  styleProfilesCreated: 0,
  styleProfilesUpdated: 0,
};

const EMPTY_BOOTSTRAP_REPORT: SystemResourceBootstrapReport = {
  genresCreated: 0,
  genresUpdated: 0,
  storyModesCreated: 0,
  storyModesUpdated: 0,
  ...EMPTY_STYLE_ENGINE_REPORT,
};

const BUILT_IN_GENRE_SEEDS: GenreSeedNode[] = [
  {
    id: "genre_action_root",
    name: "Hành động",
    description: "Lấy chiến đấu, phiêu lưu, đối kháng và sự trưởng thành của nhân vật chính làm động lực chính.",
    template: "Làm nổi bật cảnh hành động, mục tiêu rõ ràng, đối thủ leo thang liên tục và thắng thua theo giai đoạn.",
    children: [
      {
        id: "genre_action_battle",
        name: "Chiến đấu phiêu lưu",
        description: "Triển khai xoay quanh hành trình, chiến đấu, đồng đội và những thử thách không ngừng nâng cấp.",
        template: "Nhấn vào nhịp chiến đấu, biến hoá chiêu thức, phối hợp đồng đội và vượt qua từng màn.",
      },
      {
        id: "genre_action_superpower",
        name: "Siêu năng lực",
        description: "Nhân vật sở hữu năng lực đặc biệt, và không ngừng trưởng thành qua đối kháng, tập luyện và lựa chọn.",
        template: "Nhấn vào luật của năng lực, cái giá phải trả, sự khắc chế của đối thủ và sự tăng tiến sức mạnh.",
      },
      {
        id: "genre_action_martial_arts",
        name: "Võ hiệp cận chiến",
        description: "Đẩy truyện bằng võ thuật, môn phái, quan hệ giang hồ và tín niệm cá nhân.",
        template: "Nhấn vào so tài chiêu thức, xung đột môn phái, danh dự và những lựa chọn cá nhân.",
      },
    ],
  },
  {
    id: "genre_adventure_root",
    name: "Phiêu lưu",
    description: "Lấy khám phá điều chưa biết, hành trình, kho báu và phát hiện thế giới mới làm động lực chính.",
    template: "Làm nổi bật mục tiêu hành trình, tiến triển bản đồ, phát hiện điều chưa biết và phần thưởng phiêu lưu theo giai đoạn.",
    children: [
      {
        id: "genre_adventure_treasure",
        name: "Săn kho báu",
        description: "Triển khai xoay quanh di tích, kho báu, câu đố và hành trình hiểm nguy.",
        template: "Nhấn vào giải đố manh mối, thám hiểm địa điểm, phối hợp đội và phần thưởng phiêu lưu.",
      },
      {
        id: "genre_adventure_isekai",
        name: "Phiêu lưu dị giới",
        description: "Nhân vật bước vào một thế giới xa lạ, mở ra hành trình khi thích nghi môi trường và hoàn thành mục tiêu.",
        template: "Nhấn vào luật lệ dị giới, những điều thấy được trên đường, quan hệ đồng đội và thử thách trưởng thành.",
      },
    ],
  },
  {
    id: "genre_comedy_root",
    name: "Hài (Comedy)",
    description: "Tạo niềm vui đọc chính bằng sự hài hước, tương phản, hiểu lầm và tương tác nhẹ nhàng.",
    template: "Làm nổi bật sự tương phản của nhân vật, nhịp nhẹ nhàng, hoá giải hiểu lầm và tiếng cười liên tục.",
  },
  {
    id: "genre_drama_root",
    name: "Drama",
    description: "Lấy quan hệ nhân vật, lựa chọn cuộc đời, biến đổi cảm xúc và xung đột hiện thực làm cốt lõi.",
    template: "Làm nổi bật vòng cung nhân vật, thay đổi quan hệ, sự tích tụ cảm xúc và những lựa chọn then chốt.",
  },
  {
    id: "genre_horror_root",
    name: "Kinh dị (Horror)",
    description: "Đẩy truyện bằng nỗi sợ, mối đe doạ chưa biết, bầu không khí đè nén và khủng hoảng sinh tồn.",
    template: "Làm nổi bật nguồn gốc nỗi sợ, lỗ hổng thông tin, bầu không khí dồn dần và sự trả về cái giá.",
  },
  {
    id: "genre_apocalypse_root",
    name: "Tận thế (Apocalypse)",
    description: "Lấy thảm hoạ, khủng hoảng tài nguyên, trật tự sụp đổ và tái thiết xã hội làm cốt lõi.",
    template: "Làm nổi bật áp lực môi trường, tranh giành tài nguyên, quan hệ đội nhóm và việc thiết lập trật tự mới.",
    children: [
      {
        id: "genre_apocalypse_zombie",
        name: "Tận thế zombie",
        description: "Sinh tồn trong đại biến zombie và sự khan hiếm tài nguyên, đồng thời tìm kiếm một trật tự an toàn mới.",
        template: "Nhấn vào lộ trình sinh tồn, quản lý tài nguyên, lòng tin trong đội nhóm và hiểm nguy leo thang.",
      },
      {
        id: "genre_apocalypse_disaster",
        name: "Sinh tồn thảm hoạ",
        description: "Nhân vật tìm cách sinh tồn và cơ hội tái thiết sau một thảm hoạ tự nhiên hoặc do con người.",
        template: "Nhấn vào biến đổi môi trường, tài nguyên hữu hạn, lựa chọn thực tế và tái thiết trật tự.",
      },
    ],
  },
  {
    id: "genre_sports_root",
    name: "Thể thao (Sports)",
    description: "Lấy tập luyện, thi đấu, phối hợp đội và vượt giới hạn làm động lực chính.",
    template: "Làm nổi bật sự trưởng thành qua tập luyện, mục tiêu thi đấu, quan hệ đồng đội và những trận thắng thua then chốt.",
  },
  {
    id: "genre_school_life_root",
    name: "Đời sống học đường",
    description: "Lấy đời sống học đường, sự trưởng thành, quan hệ giữa người với người và nhật thường tuổi trẻ làm cốt lõi.",
    template: "Làm nổi bật bối cảnh học đường, quan hệ bạn bè, những băn khoăn khi trưởng thành và mục tiêu theo giai đoạn.",
  },
  {
    id: "genre_adult_root",
    name: "Người trưởng thành (Adult)",
    description: "Phân loại dành cho người đọc trưởng thành: chủ đề chín chắn, quan hệ thân mật, ham muốn và xung đột hiện thực.",
    template: "Xử lý quan hệ trưởng thành, cảnh thân mật và sự căng cảm xúc theo thiết lập của tác giả, giữ mức phân loại nội dung nhất quán trước sau.",
  },
  {
    id: "genre_ecchi_root",
    name: "Ecchi",
    description: "Bao gồm sự mập mờ, hài gợi cảm, sức hút thể chất và cách thể hiện hướng người lớn ở mức nhẹ.",
    template: "Kiểm soát cường độ mập mờ, gợi cảm và thể hiện thân mật theo thiết lập của tác giả, giữ nhất quán với cốt truyện và quan hệ nhân vật.",
  },
  {
    id: "genre_isekai_root",
    name: "Dị giới (Isekai)",
    description: "Nhân vật xuyên không, chuyển sinh hoặc bị triệu hồi sang một thế giới khác để mở ra cuộc đời mới.",
    template: "Làm nổi bật luật lệ dị giới, thay đổi thân phận, sự tăng tiến năng lực và mục tiêu cuộc sống mới.",
  },
  {
    id: "genre_mecha_root",
    name: "Mecha",
    description: "Lấy robot cơ giáp, khí tài, phi công và những trận đánh quy mô lớn làm hình ảnh và xung đột cốt lõi.",
    template: "Nhấn vào thiết lập cơ giáp, phối hợp lái, đối kháng chiến thuật và cái giá của chiến tranh.",
  },
  {
    id: "genre_supernatural_root",
    name: "Siêu nhiên (Supernatural)",
    description: "Hiện tượng linh dị, sức mạnh huyền bí và sự kiện siêu nhiên xuất hiện trong thế giới hiện đại hoặc hiện thực.",
    template: "Nhấn vào luật của cái dị thường, thế giới ẩn giấu, quá trình điều tra và cái giá của năng lực.",
  },
  {
    id: "genre_gl_root",
    name: "Bách hợp (GL)",
    description: "Lấy tình cảm, mối gắn kết và sự phát triển quan hệ giữa các nhân vật nữ làm cốt lõi.",
    template: "Làm nổi bật quan hệ giữa các nhân vật nữ, biến đổi cảm xúc, sự đồng hành và cùng nhau trưởng thành.",
  },
  {
    id: "genre_bl_root",
    name: "Đam mỹ (BL)",
    description: "Lấy tình cảm, mối gắn kết và sự phát triển quan hệ giữa các nhân vật nam làm cốt lõi.",
    template: "Làm nổi bật quan hệ giữa các nhân vật nam, biến đổi cảm xúc, sự đồng hành và cùng nhau trưởng thành.",
  },
  {
    id: "genre_fantasy_root",
    name: "Fantasy (Kỳ ảo)",
    description: "Lấy phép thuật, thần thoại, dị giới và các thiết lập siêu nhiên làm cốt lõi.",
    template: "Làm nổi bật luật của thế giới quan, thám hiểm kỳ quan và sự trưởng thành của nhân vật.",
    children: [
      {
        id: "genre_fantasy_eastern",
        name: "Fantasy phương Đông",
        description: "Coi trọng cả hệ thống tu luyện, thế lực môn phái lẫn tự sự về gia tộc, quốc gia.",
        template: "Nhấn vào đột phá cảnh giới và đấu trí giữa các thế lực.",
      },
      {
        id: "genre_fantasy_western",
        name: "Fantasy phương Tây",
        description: "Các yếu tố kinh điển như hiệp sĩ, pháp sư, sinh vật thần thoại.",
        template: "Nhấn vào nhiệm vụ phiêu lưu và xung đột sử thi.",
      },
      {
        id: "genre_fantasy_xianxia",
        name: "Tiên hiệp",
        description: "Lấy hệ thống tu chân, đạo thống nhân quả, phi thăng trường sinh làm mô-típ cốt lõi.",
        template: "Nhấn vào con đường tu hành, cái giá của nhân quả và những lựa chọn về môn phái / tiên đồ.",
      },
      {
        id: "genre_fantasy_high_martial",
        name: "Cao võ",
        description: "Coi trọng cả hệ thống sức mạnh cường độ cao, trưởng thành qua chiến đấu lẫn bước nhảy giữa các tầng lớp trong thế giới.",
        template: "Nhấn vào nâng cấp sức mạnh, áp chế trong chiến đấu và đột phá qua các tầng trật tự.",
      },
    ],
  },
  {
    id: "genre_urban_root",
    name: "Đời sống đô thị",
    description: "Lấy thành phố hiện đại làm sân khấu chính, nhấn vào xung đột hiện thực và quan hệ nhân vật.",
    template: "Làm nổi bật cảm giác nhịp điệu và những chi tiết đời thường.",
    children: [
      {
        id: "genre_urban_superpower",
        name: "Dị năng đô thị",
        description: "Chồng thêm năng lực siêu thường, luật lệ bí ẩn hoặc nghề nghiệp đặc biệt lên khung đô thị hiện đại.",
        template: "Nhấn vào cảm giác tương phản và không gian nâng cấp khi trật tự hiện thực va chạm với thiết lập dị năng.",
      },
      {
        id: "genre_urban_workplace",
        name: "Công sở đô thị",
        description: "Đẩy cốt truyện xoay quanh trưởng thành nghề nghiệp, quan hệ tổ chức và lợi ích hiện thực.",
        template: "Nhấn vào áp lực dự án, đấu trí chốn công sở và sự trả về năng lực.",
      },
      {
        id: "genre_urban_life",
        name: "Đời sống thường nhật",
        description: "Lấy đời sống hiện thực, quan hệ láng giềng, gia đình và kinh doanh đời thường làm sân khấu chính.",
        template: "Nhấn vào cảm giác đời sống, sự tiến triển từng chút một và sự ấm dần hoặc tích luỹ bền bỉ.",
      },
    ],
  },
  {
    id: "genre_history_root",
    name: "Lịch sử (Historical)",
    description: "Lấy kết cấu xã hội thời cổ đại hoặc mang tính lịch sử làm sân khấu, nhấn vào ràng buộc của thời đại và biến chuyển cục diện.",
    template: "Làm nổi bật bầu không khí thời đại, tầng lớp thân phận và sự vận động của đại cục.",
    children: [
      {
        id: "genre_history_alt",
        name: "Lịch sử giả tưởng",
        description: "Mượn chất liệu lịch sử và logic thể chế, nhưng cho phép tái dựng các thế lực và hướng đi của sự kiện then chốt.",
        template: "Nhấn vào bầu không khí thời đại, đấu trí thể chế và viết lại vận mệnh.",
      },
      {
        id: "genre_history_power",
        name: "Chính trị quyền mưu",
        description: "Triển khai xoay quanh triều cục, phe phái, sự sinh tồn chốn quan trường và những lựa chọn chính trị.",
        template: "Nhấn vào đấu trí phe phái, cục diện đảo chiều và những lựa chọn quyền lực có cái giá rõ ràng.",
      },
      {
        id: "genre_history_war",
        name: "Chiến tranh tranh bá",
        description: "Triển khai liên tục xoay quanh mở rộng thế lực, tiến triển chiến tranh và tái cấu trúc đại cục.",
        template: "Nhấn vào nhịp chinh phạt, điều phối tài nguyên và thay đổi bản đồ.",
      },
    ],
  },
  {
    id: "genre_scifi_root",
    name: "Khoa học viễn tưởng (Sci-Fi)",
    description: "Lấy biến cách công nghệ, trật tự tương lai, thám hiểm vũ trụ hoặc sinh tồn hậu tận thế làm động lực cốt lõi.",
    template: "Làm nổi bật thiết lập công nghệ, luật lệ tương lai và cái giá của sự sinh tồn.",
    children: [
      {
        id: "genre_scifi_near_future",
        name: "Sci-Fi tương lai gần",
        description: "Xã hội, công nghệ và xung đột đời thường của tương lai gần, mở rộng từ hiện thực.",
        template: "Nhấn vào việc biến cách công nghệ viết lại đời sống, thể chế và kết cấu quan hệ hiện thực ra sao.",
      },
      {
        id: "genre_scifi_cyberpunk",
        name: "Cyberpunk",
        description: "Công nghệ cao đời sống thấp, tư bản độc quyền, cải tạo nghĩa thể và sự tha hoá thân phận cùng tồn tại.",
        template: "Nhấn vào sự đè ép của công nghệ, sự xé rách tầng lớp và cuộc phản kháng cá nhân.",
      },
      {
        id: "genre_scifi_apocalypse",
        name: "Sci-Fi tận thế",
        description: "Đại biến, khủng hoảng tài nguyên và tái thiết trật tự cùng chi phối lựa chọn của nhân vật.",
        template: "Nhấn vào áp lực sinh tồn, tranh giành tài nguyên và dựng lại trật tự mới.",
      },
      {
        id: "genre_scifi_space",
        name: "Phiêu lưu liên sao",
        description: "Đẩy cốt truyện bằng hải trình xa, nền văn minh chưa biết, hành động hạm đội hoặc nhiệm vụ liên sao.",
        template: "Nhấn vào khám phá điều chưa biết, phối hợp tập thể và sự va chạm giữa các nền văn minh.",
      },
    ],
  },
  {
    id: "genre_suspense_root",
    name: "Trinh thám (Mystery)",
    description: "Đẩy sự đọc tiếp liên tục bằng câu đố, hiện tượng dị thường, hiểm nguy áp sát và sự thu hồi sự thật.",
    template: "Làm nổi bật tiến triển manh mối, những chi tiết dị thường và áp lực tăng dần.",
    children: [
      {
        id: "genre_suspense_detective",
        name: "Điều tra phá án (Detective)",
        description: "Triển khai liên tục xoay quanh điều tra vụ án, chuỗi chứng cứ và suy diễn logic.",
        template: "Nhấn vào kết cấu vụ án, quá trình điều tra và sự thu hồi của suy luận.",
      },
      {
        id: "genre_suspense_thriller",
        name: "Giật gân (Thriller)",
        description: "Hiểm nguy áp sát liên tục, coi trọng cả mối đe doạ chưa biết lẫn cảm giác đè nén tâm lý.",
        template: "Nhấn vào rủi ro leo thang, lỗ hổng thông tin và bầu không khí đè nén.",
      },
      {
        id: "genre_suspense_weird_rules",
        name: "Quái đàm luật lệ (Weird Rules)",
        description: "Tổ chức câu chuyện xoay quanh luật lệ, điều cấm kỵ, logic dị thường và cái giá của việc làm sai.",
        template: "Nhấn vào nhận diện luật lệ, thăm dò ranh giới và sự thu hồi của cái dị thường.",
      },
      {
        id: "genre_suspense_infinite",
        name: "Phó bản vô hạn (Survival)",
        description: "Đẩy sinh tồn và phá cục qua từng phó bản, màn chơi hoặc không gian lặp.",
        template: "Nhấn vào mục tiêu phó bản, cơ chế thông quan, áp lực cái chết và sự thoát ra theo giai đoạn.",
      },
    ],
  },
  {
    id: "genre_romance_root",
    name: "Ngôn tình (Romance)",
    description: "Lấy sự tiến triển quan hệ, sự trả về cảm xúc và cảm giác đồng hành của nhân vật làm động lực đọc chính.",
    template: "Làm nổi bật thay đổi quan hệ, sự giằng co cảm xúc và những lần hồi đáp theo giai đoạn.",
    children: [
      {
        id: "genre_romance_modern",
        name: "Ngôn tình hiện đại",
        description: "Sự tiến triển quan hệ, giằng co cảm xúc và lựa chọn hiện thực trong bối cảnh đời sống hiện đại.",
        template: "Nhấn vào bối cảnh đời sống, sự đọc sai trong quan hệ và sự thu hồi cảm xúc.",
      },
      {
        id: "genre_romance_ancient",
        name: "Ngôn tình cổ đại",
        description: "Lễ giáo cổ đại, ràng buộc thân phận và những vướng mắc số phận cùng tác động lên sự phát triển quan hệ.",
        template: "Nhấn vào giới hạn lễ giáo, chênh lệch thân phận và những lựa chọn về quan hệ.",
      },
      {
        id: "genre_romance_campus",
        name: "Thanh xuân học đường",
        description: "Triển khai xoay quanh sự trưởng thành, quan hệ bạn bè, sự thăm dò lại gần và bầu không khí tuổi trẻ.",
        template: "Nhấn vào tâm sự khi trưởng thành, sự thăm dò quan hệ và sự trả về cảm giác rung động theo giai đoạn.",
      },
      {
        id: "genre_romance_harem",
        name: "Harem",
        description: "Nhân vật chính đồng thời phát triển quan hệ tình cảm với nhiều nhân vật cốt lõi; điểm nhìn nằm ở sự giằng co cảm xúc đa tuyến, sự khác biệt giữa các thành viên và cục diện quan hệ liên tục thay đổi.",
        template: "Nhấn vào sức hút và mong muốn riêng của từng nhân vật cốt lõi, các tuyến tình cảm đẩy song song và xác nhận quan hệ theo giai đoạn; tránh để nhân vật thành bình phong hoặc công cụ thay phiên.",
      },
    ],
  },
  {
    id: "genre_game_root",
    name: "Game",
    description: "Triển khai liên tục xoay quanh thi đấu, hệ thống nghề nghiệp, trưởng thành theo chỉ số hoặc nhiệm vụ được hệ thống hoá.",
    template: "Làm nổi bật mục tiêu theo luật, trưởng thành theo giai đoạn và sự trả về kết quả.",
    children: [
      {
        id: "genre_game_esports",
        name: "Thể thao điện tử (Esports)",
        description: "Lấy đối kháng ở các giải đấu, sự ăn ý của đội, trưởng thành qua tập luyện và đột phá thành tích làm tuyến chính.",
        template: "Nhấn vào nhịp thi đấu, phối hợp đội và sự trả về ở những ván then chốt.",
      },
      {
        id: "genre_game_online",
        name: "MMO",
        description: "Triển khai xoay quanh hệ thống nghề nghiệp, phó bản, quan hệ công hội và trưởng thành trong thế giới game.",
        template: "Nhấn vào trưởng thành theo hệ thống, tiến triển phó bản và cạnh tranh tài nguyên.",
      },
    ],
  },
];

function mergeBootstrapReport(
  base: SystemResourceBootstrapReport,
  patch: Partial<SystemResourceBootstrapReport>,
): SystemResourceBootstrapReport {
  return {
    genresCreated: base.genresCreated + (patch.genresCreated ?? 0),
    genresUpdated: base.genresUpdated + (patch.genresUpdated ?? 0),
    storyModesCreated: base.storyModesCreated + (patch.storyModesCreated ?? 0),
    storyModesUpdated: base.storyModesUpdated + (patch.storyModesUpdated ?? 0),
    styleTemplatesCreated: base.styleTemplatesCreated + (patch.styleTemplatesCreated ?? 0),
    styleTemplatesUpdated: base.styleTemplatesUpdated + (patch.styleTemplatesUpdated ?? 0),
    antiAiRulesCreated: base.antiAiRulesCreated + (patch.antiAiRulesCreated ?? 0),
    antiAiRulesUpdated: base.antiAiRulesUpdated + (patch.antiAiRulesUpdated ?? 0),
    styleProfilesCreated: base.styleProfilesCreated + (patch.styleProfilesCreated ?? 0),
    styleProfilesUpdated: base.styleProfilesUpdated + (patch.styleProfilesUpdated ?? 0),
  };
}

function mergeStyleEngineReport(
  base: StyleEngineSeedReport,
  patch: Partial<StyleEngineSeedReport>,
): StyleEngineSeedReport {
  return {
    styleTemplatesCreated: base.styleTemplatesCreated + (patch.styleTemplatesCreated ?? 0),
    styleTemplatesUpdated: base.styleTemplatesUpdated + (patch.styleTemplatesUpdated ?? 0),
    antiAiRulesCreated: base.antiAiRulesCreated + (patch.antiAiRulesCreated ?? 0),
    antiAiRulesUpdated: base.antiAiRulesUpdated + (patch.antiAiRulesUpdated ?? 0),
    styleProfilesCreated: base.styleProfilesCreated + (patch.styleProfilesCreated ?? 0),
    styleProfilesUpdated: base.styleProfilesUpdated + (patch.styleProfilesUpdated ?? 0),
  };
}

async function seedGenreNode(
  tx: Prisma.TransactionClient,
  node: GenreSeedNode,
  parentId: string | null,
  mode: SystemResourceSeedMode,
): Promise<Pick<SystemResourceBootstrapReport, "genresCreated" | "genresUpdated">> {
  let report = { genresCreated: 0, genresUpdated: 0 };
  const existing = await tx.novelGenre.findUnique({
    where: { id: node.id },
    select: { id: true, name: true, description: true, template: true },
  });

  if (existing) {
    // Legacy installations contained the built-in catalog in Chinese. Repair
    // only those records during normal startup; preserve user-edited records
    // written in another language.
    const isLegacyChineseRecord = containsCjkText(existing.name)
      || containsCjkText(existing.description)
      || containsCjkText(existing.template);
    if (mode === "sync_existing" || isLegacyChineseRecord) {
      await tx.novelGenre.update({
        where: { id: node.id },
        data: {
          name: node.name,
          description: node.description,
          template: node.template,
          parentId,
        },
      });
      report = { genresCreated: 0, genresUpdated: 1 };
    }
  } else {
    await tx.novelGenre.create({
      data: {
        id: node.id,
        name: node.name,
        description: node.description,
        template: node.template,
        parentId,
      },
    });
    report = { genresCreated: 1, genresUpdated: 0 };
  }

  for (const child of node.children ?? []) {
    const childReport = await seedGenreNode(tx, child, node.id, mode);
    report = {
      genresCreated: report.genresCreated + childReport.genresCreated,
      genresUpdated: report.genresUpdated + childReport.genresUpdated,
    };
  }

  return report;
}

async function seedStoryModeNode(
  tx: Prisma.TransactionClient,
  node: StoryModeSeedNode["children"][number] | StoryModeSeedNode,
  parentId: string | null,
  mode: SystemResourceSeedMode,
): Promise<Pick<SystemResourceBootstrapReport, "storyModesCreated" | "storyModesUpdated">> {
  let report = { storyModesCreated: 0, storyModesUpdated: 0 };
  const existing = await tx.novelStoryMode.findUnique({
    where: { id: node.id },
    select: { id: true, name: true, description: true, template: true },
  });

  const data = {
    name: node.name,
    description: node.description,
    template: node.template,
    profileJson: serializeStoryModeProfile(node.profile),
    parentId,
  };

  if (existing) {
    // Legacy installations contained the built-in catalog in Chinese. Repair
    // only those records during normal startup; preserve user-edited records
    // written in another language.
    const isLegacyChineseRecord = containsCjkText(existing.name)
      || containsCjkText(existing.description)
      || containsCjkText(existing.template);
    if (mode === "sync_existing" || isLegacyChineseRecord) {
      await tx.novelStoryMode.update({
        where: { id: node.id },
        data,
      });
      report = { storyModesCreated: 0, storyModesUpdated: 1 };
    }
  } else {
    await tx.novelStoryMode.create({
      data: {
        id: node.id,
        ...data,
      },
    });
    report = { storyModesCreated: 1, storyModesUpdated: 0 };
  }

  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      const childReport = await seedStoryModeNode(tx, child, node.id, mode);
      report = {
        storyModesCreated: report.storyModesCreated + childReport.storyModesCreated,
        storyModesUpdated: report.storyModesUpdated + childReport.storyModesUpdated,
      };
    }
  }

  return report;
}

function buildStyleTemplateWriteData(template: DefaultTemplateDefinition) {
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    tagsJson: serializeJson(template.tags),
    applicableGenresJson: serializeJson(template.applicableGenres),
    analysisMarkdown: template.analysisMarkdown,
    narrativeRulesJson: serializeJson(template.narrativeRules),
    characterRulesJson: serializeJson(template.characterRules),
    languageRulesJson: serializeJson(template.languageRules),
    rhythmRulesJson: serializeJson(template.rhythmRules),
    defaultAntiAiRuleKeysJson: serializeJson(template.defaultAntiAiRuleKeys),
  };
}

function buildAntiAiRuleWriteData(rule: DefaultAntiAiRuleDefinition) {
  return {
    name: rule.name,
    type: rule.type,
    severity: rule.severity,
    description: rule.description,
    detectPatternsJson: serializeJson(rule.detectPatterns),
    rewriteSuggestion: rule.rewriteSuggestion,
    promptInstruction: rule.promptInstruction,
    autoRewrite: rule.autoRewrite,
    enabled: rule.enabled,
    globalBaselineEnabled: rule.globalBaselineEnabled,
  };
}

function buildStarterStyleProfileSourceRef(definition: DefaultStarterStyleProfileDefinition): string {
  return `${STARTER_STYLE_PROFILE_SOURCE_PREFIX}${definition.key}`;
}

function buildStarterStyleProfileWriteData(input: {
  definition: DefaultStarterStyleProfileDefinition;
  template: DefaultTemplateDefinition;
}) {
  return {
    name: input.definition.name,
    description: input.definition.description,
    category: input.template.category,
    tagsJson: serializeJson(input.template.tags),
    applicableGenresJson: serializeJson(input.template.applicableGenres),
    sourceType: "manual",
    sourceRefId: buildStarterStyleProfileSourceRef(input.definition),
    sourceContent: null,
    extractedFeaturesJson: serializeJson([]),
    analysisMarkdown: input.template.analysisMarkdown,
    narrativeRulesJson: serializeJson(input.template.narrativeRules),
    characterRulesJson: serializeJson(input.template.characterRules),
    languageRulesJson: serializeJson(input.template.languageRules),
    rhythmRulesJson: serializeJson(input.template.rhythmRules),
    status: "active",
  };
}

async function seedStarterStyleProfiles(
  tx: Prisma.TransactionClient,
  mode: SystemResourceSeedMode,
): Promise<StyleEngineSeedReport> {
  let report = { ...EMPTY_STYLE_ENGINE_REPORT };
  const totalProfiles = await tx.styleProfile.count();
  if (mode === "missing_only" && totalProfiles > 0) {
    return report;
  }

  for (const definition of DEFAULT_STARTER_STYLE_PROFILES) {
    const template = DEFAULT_STYLE_TEMPLATES.find((item) => item.key === definition.templateKey);
    if (!template) {
      continue;
    }

    const sourceRefId = buildStarterStyleProfileSourceRef(definition);
    const existing = await tx.styleProfile.findFirst({
      where: { sourceRefId },
      select: { id: true },
    });
    const antiAiRules = template.defaultAntiAiRuleKeys.length > 0
      ? await tx.antiAiRule.findMany({
        where: {
          key: {
            in: template.defaultAntiAiRuleKeys,
          },
        },
        select: { id: true },
      })
      : [];

    if (existing) {
      if (mode === "sync_existing") {
        await tx.styleProfile.update({
          where: { id: existing.id },
          data: buildStarterStyleProfileWriteData({ definition, template }),
        });
        await tx.styleProfileAntiAiRule.deleteMany({
          where: { styleProfileId: existing.id },
        });
        if (antiAiRules.length > 0) {
          await tx.styleProfileAntiAiRule.createMany({
            data: antiAiRules.map((rule) => ({
              styleProfileId: existing.id,
              antiAiRuleId: rule.id,
              enabled: true,
            })),
          });
        }
        report = mergeStyleEngineReport(report, { styleProfilesUpdated: 1 });
      }
      continue;
    }

    const created = await tx.styleProfile.create({
      data: {
        ...buildStarterStyleProfileWriteData({ definition, template }),
      },
      select: { id: true },
    });
    if (antiAiRules.length > 0) {
      await tx.styleProfileAntiAiRule.createMany({
        data: antiAiRules.map((rule) => ({
          styleProfileId: created.id,
          antiAiRuleId: rule.id,
          enabled: true,
        })),
      });
    }
    report = mergeStyleEngineReport(report, { styleProfilesCreated: 1 });
  }

  return report;
}

export async function seedStyleEngineStarterData(
  mode: SystemResourceSeedMode = "missing_only",
): Promise<StyleEngineSeedReport> {
  return prisma.$transaction(async (tx) => {
    let report = { ...EMPTY_STYLE_ENGINE_REPORT };

    for (const rule of DEFAULT_ANTI_AI_RULES) {
      const existing = await tx.antiAiRule.findUnique({
        where: { key: rule.key },
        select: { id: true },
      });
      if (existing) {
        if (mode === "sync_existing") {
          await tx.antiAiRule.update({
            where: { key: rule.key },
            data: buildAntiAiRuleWriteData(rule),
          });
          report = mergeStyleEngineReport(report, { antiAiRulesUpdated: 1 });
        }
        continue;
      }

      await tx.antiAiRule.create({
        data: {
          key: rule.key,
          ...buildAntiAiRuleWriteData(rule),
        },
      });
      report = mergeStyleEngineReport(report, { antiAiRulesCreated: 1 });
    }

    for (const template of DEFAULT_STYLE_TEMPLATES) {
      const existing = await tx.styleTemplate.findUnique({
        where: { key: template.key },
        select: { id: true },
      });
      if (existing) {
        if (mode === "sync_existing") {
          await tx.styleTemplate.update({
            where: { key: template.key },
            data: buildStyleTemplateWriteData(template),
          });
          report = mergeStyleEngineReport(report, { styleTemplatesUpdated: 1 });
        }
        continue;
      }

      await tx.styleTemplate.create({
        data: {
          key: template.key,
          ...buildStyleTemplateWriteData(template),
        },
      });
      report = mergeStyleEngineReport(report, { styleTemplatesCreated: 1 });
    }

    report = mergeStyleEngineReport(report, await seedStarterStyleProfiles(tx, mode));

    return report;
  });
}

export async function ensureSystemResourceStarterData(
  options: {
    mode?: SystemResourceSeedMode;
  } = {},
): Promise<SystemResourceBootstrapReport> {
  const mode = options.mode ?? "missing_only";
  let report = { ...EMPTY_BOOTSTRAP_REPORT };

  const genreReport = await prisma.$transaction(async (tx) => {
    let acc = { genresCreated: 0, genresUpdated: 0 };
    for (const root of BUILT_IN_GENRE_SEEDS) {
      const seeded = await seedGenreNode(tx, root, null, mode);
      acc = {
        genresCreated: acc.genresCreated + seeded.genresCreated,
        genresUpdated: acc.genresUpdated + seeded.genresUpdated,
      };
    }
    return acc;
  });
  report = mergeBootstrapReport(report, genreReport);

  const storyModeReport = await prisma.$transaction(async (tx) => {
    let acc = { storyModesCreated: 0, storyModesUpdated: 0 };
    for (const root of BUILT_IN_STORY_MODE_SEEDS) {
      const seeded = await seedStoryModeNode(tx, root, null, mode);
      acc = {
        storyModesCreated: acc.storyModesCreated + seeded.storyModesCreated,
        storyModesUpdated: acc.storyModesUpdated + seeded.storyModesUpdated,
      };
    }
    return acc;
  });
  report = mergeBootstrapReport(report, storyModeReport);

  const styleReport = await seedStyleEngineStarterData(mode);
  report = mergeBootstrapReport(report, styleReport);

  return report;
}

export function hasSystemResourceBootstrapChanges(report: SystemResourceBootstrapReport): boolean {
  return Object.values(report).some((value) => value > 0);
}
