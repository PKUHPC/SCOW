import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import clsx from "clsx";
import React from "react";

import styles from "./HomepageFeatures.module.css";

interface FeatureItem {
  title: string;
  image: string;
  description: JSX.Element;
}

const FeatureList: FeatureItem[] = [
  {
    title: "方便使用",
    image: "/img/undraw_docusaurus_react.svg",
    description: <>SCOW让超算用户和运维人员都可以在浏览器中完成日常科研和运维任务。</>,
  },
  {
    title: "方便部署",
    image: "/img/undraw_docusaurus_tree.svg",
    description: <>SCOW使用模块化结构，可以根据自己的需求部署全部或者部分功能。</>,
  },
  {
    title: "方便扩展",
    image: "/img/undraw_docusaurus_mountain.svg",
    description: (
      <p>
        使用任何语言，
        <br />
        通过
        <Link href="/docs/integration/scow-api-hook/api">SCOW API</Link>
        调用SCOW API，
        <br />
        通过
        <Link href="/docs/integration/scow-api-hook/hook">SCOW Hook</Link>
        监听SCOW事件，
        <br />
        使用
        <Link href="/docs/integration/ui-extension">UI扩展</Link>
        将您的系统集成进SCOW。
      </p>
    ),
  },
];

function Feature({ title, image, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <img className={styles.featureSvg} alt={title} src={useBaseUrl(image)} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
