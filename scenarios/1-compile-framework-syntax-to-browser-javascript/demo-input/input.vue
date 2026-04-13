<!-- Vue SFC 输入样例：浏览器也不能直接执行这个模板块。 -->
<template>
  <section>
    <h1>{{ title }}</h1>
    <p>{{ subtitle }}</p>
  </section>
</template>

<script>
export default {
  data() {
    return {
      title: 'Hello Vue',
      subtitle: 'template needs compilation'
    };
  }
};
</script>
