<?php
$dev_mode = false;
$vcon = false;
if (!$dev_mode) {
    include "fc.php";
    // 统计信息
    // $time_now = date("Y-m-d H:i:s");
    $dbc = dbc();
    $ms_time = microtime(true);
    // $gen_uuid=uuid(); //生成唯一id
    if (isset($_SERVER['HTTP_X_REAL_IP'])) {
        $ip = "O:" . $_SERVER['REMOTE_ADDR'] . ' X:' . $_SERVER['HTTP_X_REAL_IP'];
    } else {
        $ip = $_SERVER['REMOTE_ADDR'];
    }
    $st = $dbc->prepare("INSERT INTO `cha_stat` (`ip`,`ms`) VALUES (:ip,:ms)");
    $st->execute(['ip' => $ip, 'ms' => $ms_time]);
}

?>
<!DOCTYPE html>
<script>
    const accessCount = <?php
                        if (!$dev_mode) {
                            // 用于显示次数
                            $r = fetch($dbc, "select count(*) from cha_stat;");
                            print_r($r[0]['count(*)']);
                        } else {
                            print_r("'Dev Mode'");
                        }
                        ?>
</script>

<?php
if ($vcon) {
    echo '<script src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"></script>
<script>
var vConsole = new window.VConsole();
</script>';
}

include "ui.php";
?>